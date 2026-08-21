"""
Tests for the audit log endpoint and the record_admin_action helper.

* Paginated envelope shape (count/next/previous/results)
* page_size = 100
* Permission checks (admin/superadmin allowed, student/anonymous denied)
* record_admin_action helper creates rows and is failure-safe
"""

from django.test import TestCase, override_settings
from rest_framework.test import APITestCase

from accounts.models import Role, User
from .models import AuditLog
from .services import record_admin_action


# ── Unit: record_admin_action ────────────────────────────────────────────────

class RecordAdminActionTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@audit.test', firstname='Aud', lastname='It',
            phone_number='08010000001', role=Role.ADMIN,
            nin_hash='nin-hash-admin-01', password='x', passport='',
        )

    def test_creates_row(self):
        record_admin_action(self.admin, 'Test action', 'System', '')
        self.assertEqual(AuditLog.objects.count(), 1)
        log = AuditLog.objects.first()
        self.assertEqual(log.admin, self.admin)
        self.assertEqual(log.action, 'Test action')
        self.assertEqual(log.entity_type, 'System')
        self.assertEqual(log.entity_id, '')

    def test_entity_id_stored_as_string(self):
        record_admin_action(self.admin, 'Action', 'Application', 42)
        log = AuditLog.objects.first()
        self.assertEqual(log.entity_id, '42')

    def test_none_admin_defaults_to_system(self):
        record_admin_action(None, 'System action', 'System')
        log = AuditLog.objects.first()
        self.assertIsNone(log.admin)

    def test_unauthenticated_user_defaults_to_system(self):
        """A user object that isn't authenticated should be treated as None."""
        fake = type('Fake', (), {'is_authenticated': False})()
        record_admin_action(fake, 'System action', 'System')
        log = AuditLog.objects.first()
        self.assertIsNone(log.admin)

    def test_never_raises(self):
        """The helper must catch its own exceptions."""
        record_admin_action(self.admin, 'OK', None, None)
        self.assertEqual(AuditLog.objects.count(), 1)



# ── Integration: GET /audit/ ─────────────────────────────────────────────────

@override_settings(
    SECURE_SSL_REDIRECT=False,  # tests hit the API over http; keep the request local
    STORAGES={
        'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
        'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
    },
)
class AuditLogApiTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.superadmin = User.objects.create_superuser(
            email='super@audit.test', firstname='Super', lastname='Admin',
            nin_hash='01010101011', phone_number='08020000001', password='x',
        )
        cls.admin = User.objects.create_user(
            email='admin@audit.test', firstname='Reg', lastname='Admin',
            phone_number='08020000002', role=Role.ADMIN,
            nin_hash='nin-hash-admin-02', password='x', passport='',
        )
        cls.student = User.objects.create_user(
            email='student@audit.test', firstname='Stu', lastname='Dent',
            phone_number='08020000003', role=Role.STUDENT,
            nin_hash='nin-hash-stu-01', password='x', passport='',
        )

    def _bulk_logs(self, count):
        """Create *count* AuditLog rows (same admin, varied actions)."""
        AuditLog.objects.bulk_create([
            AuditLog(
                admin=self.admin,
                action=f'Bulk action #{i}',
                entity_type='Application',
                entity_id=str(i),
            )
            for i in range(count)
        ])

    # ── Pagination envelope ──────────────────────────────────────────────────

    def test_paginated_envelope(self):
        self._bulk_logs(10)
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/audit/')
        self.assertEqual(resp.status_code, 200)
        self.assertIn('count', resp.data)
        self.assertIn('next', resp.data)
        self.assertIn('previous', resp.data)
        self.assertIn('results', resp.data)
        self.assertEqual(resp.data['count'], 10)

    def test_page_size_is_100(self):
        self._bulk_logs(150)
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/audit/')
        self.assertEqual(len(resp.data['results']), 100)
        self.assertEqual(resp.data['count'], 150)
        self.assertIsNotNone(resp.data['next'])

    def test_second_page(self):
        self._bulk_logs(150)
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/audit/?page=2')
        self.assertEqual(len(resp.data['results']), 50)
        self.assertEqual(resp.data['count'], 150)
        self.assertIsNone(resp.data['next'])

    # ── Permissions ──────────────────────────────────────────────────────────

    def test_superadmin_can_read(self):
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/audit/')
        self.assertEqual(resp.status_code, 200)

    def test_admin_can_read(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get('/audit/')
        self.assertEqual(resp.status_code, 200)

    def test_student_denied(self):
        self.client.force_authenticate(user=self.student)
        resp = self.client.get('/audit/')
        self.assertEqual(resp.status_code, 403)

    # ── Serialized fields ────────────────────────────────────────────────────

    def test_serialized_fields(self):
        AuditLog.objects.create(
            admin=self.admin, action='Test', entity_type='Application',
            entity_id='42',
        )
        self.client.force_authenticate(user=self.superadmin)
        resp = self.client.get('/audit/')
        self.assertEqual(resp.status_code, 200)
        row = resp.data['results'][0]
        self.assertIn('id', row)
        self.assertIn('admin_name', row)
        self.assertIn('action', row)
        self.assertIn('entity_type', row)
        self.assertIn('entity_id', row)
        self.assertIn('timestamp', row)
        self.assertEqual(row['admin_name'], 'Reg Admin')
        self.assertEqual(row['action'], 'Test')
        self.assertEqual(row['entity_type'], 'Application')
        self.assertEqual(row['entity_id'], '42')

    def test_anonymous_denied(self):
        resp = self.client.get('/audit/')
        # Anonymous requests fail authentication before permission checks.
        self.assertEqual(resp.status_code, 401)


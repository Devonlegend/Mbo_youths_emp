"""Tests for server-side NIN hashing and cross-user NIN uniqueness.

Unit tests cover the hash_nin utility; integration tests exercise the
/auth/register/ endpoint and the DB-level unique constraint on User.nin_hash.
"""
import hashlib

from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import Role, User
from accounts.utils import hash_nin
from students.models import Student

# Keep file uploads in memory so tests never touch Cloudinary.
TEST_STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ unit: hash_nin â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@override_settings(NIN_HASH_PEPPER='unit-test-pepper')
class HashNinTests(TestCase):
    def test_deterministic_for_same_input(self):
        self.assertEqual(hash_nin('12345678901'), hash_nin('12345678901'))

    def test_differs_for_different_input(self):
        self.assertNotEqual(hash_nin('12345678901'), hash_nin('10987654321'))

    def test_output_is_64_char_hex(self):
        digest = hash_nin('12345678901')
        self.assertEqual(len(digest), 64)
        int(digest, 16)  # raises ValueError if not valid hex

    def test_pepper_is_applied(self):
        expected = hashlib.sha256(b'unit-test-pepper12345678901').hexdigest()
        self.assertEqual(hash_nin('12345678901'), expected)

    def test_pepper_changes_output(self):
        with_default = hash_nin('12345678901')
        with override_settings(NIN_HASH_PEPPER='a-different-pepper'):
            self.assertNotEqual(hash_nin('12345678901'), with_default)

    def test_strips_surrounding_whitespace(self):
        self.assertEqual(hash_nin('  12345678901 '), hash_nin('12345678901'))

    def test_invalid_nin_raises(self):
        for bad in ('', None, '123', '123456789012', 'abcdefghijk', '1234567890a'):
            with self.subTest(value=bad):
                with self.assertRaises(ValueError):
                    hash_nin(bad)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ integration: /auth/register/ â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@override_settings(STORAGES=TEST_STORAGES, NIN_HASH_PEPPER='integration-pepper')
class RegisterNinTests(APITestCase):
    def setUp(self):
        # Throttling is cache-backed; clear it so repeated registrations in tests
        # don't trip the auth rate limit.
        cache.clear()
        self.url = reverse('register')

    def _passport(self):
        return SimpleUploadedFile('passport.png', b'fake-png-bytes', content_type='image/png')

    def _payload(self, **overrides):
        data = {
            'email': 'ada@example.com',
            'firstname': 'Ada',
            'lastname': 'Eze',
            'phone_number': '08012345678',
            'password': 'Sup3r$ecret',
            'nin': '12345678901',
            'date_of_birth': '2000-01-01',
            'gender': 'female',
            'ward': 'ibaka',
            'lga': 'mbo',
            'passport': self._passport(),
        }
        data.update(overrides)
        return data

    def test_register_stores_hash_not_raw_nin(self):
        resp = self.client.post(self.url, self._payload(), format='multipart')
        self.assertEqual(resp.status_code, 201, resp.data)

        user = User.objects.get(email='ada@example.com')
        self.assertEqual(user.nin_hash, hash_nin('12345678901'))
        self.assertEqual(len(user.nin_hash), 64)
        self.assertNotIn('12345678901', user.nin_hash)
        self.assertEqual(user.role, Role.STUDENT)

        # Student row mirrors the same hash.
        student = Student.objects.get(pk=user.pk)
        self.assertEqual(student.nin_hash, user.nin_hash)

    def test_duplicate_nin_is_rejected(self):
        first = self.client.post(self.url, self._payload(), format='multipart')
        self.assertEqual(first.status_code, 201, first.data)

        cache.clear()  # avoid the auth throttle for the second call
        second = self.client.post(
            self.url,
            self._payload(email='other@example.com', phone_number='08087654321'),
            format='multipart',
        )
        self.assertEqual(second.status_code, 400)
        self.assertEqual(second.data.get('code'), 'nin_taken')
        self.assertEqual(User.objects.count(), 1)

    def test_missing_nin_is_rejected(self):
        payload = self._payload()
        payload.pop('nin')
        resp = self.client.post(self.url, payload, format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(User.objects.count(), 0)

    def test_malformed_nin_is_rejected(self):
        resp = self.client.post(self.url, self._payload(nin='123'), format='multipart')
        self.assertEqual(resp.status_code, 400)
        self.assertEqual(User.objects.count(), 0)


# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ integration: DB-level uniqueness â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
@override_settings(STORAGES=TEST_STORAGES, NIN_HASH_PEPPER='integration-pepper')
class NinUniqueConstraintTests(TestCase):
    def _make_user(self, email, phone):
        return User.objects.create_user(
            email=email,
            firstname='Ada',
            lastname='Eze',
            phone_number=phone,
            role=Role.STUDENT,
            nin_hash=hash_nin('12345678901'),
            password='Sup3r$ecret',
        )

    def test_duplicate_nin_hash_raises_integrity_error(self):
        self._make_user('a@example.com', '08012345678')
        with self.assertRaises(IntegrityError):
            self._make_user('b@example.com', '08087654321')

"""Tests for the Student API.

Covers the passport field specifically: the photo is stored on the linked
User (accounts.User.passport) at registration, while the legacy
Student.passport column is never written to. The serializer must therefore
surface the User's photo under the `passport` key.
"""
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APITestCase

from accounts.models import User
from students.models import Student

# Keep file uploads in memory so tests never touch Cloudinary.
TEST_STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=TEST_STORAGES, SECURE_SSL_REDIRECT=False)
class StudentDetailPassportTests(APITestCase):
    """GET /students/{id}/ returns the passport from the linked User."""

    def setUp(self):
        self.admin = User.objects.create_user(
            email='admin@passport.test', firstname='A', lastname='D',
            phone_number='08090001111', role='admin',
            nin_hash='nin-hash-passport-adm', password='x', passport='',
        )
        self.client.force_authenticate(user=self.admin)

    def _passport(self):
        return SimpleUploadedFile(
            'passport.png', b'fake-png-bytes', content_type='image/png')

    def _student_with_passport(self):
        user = User.objects.create_user(
            email='ada@passport.test', firstname='Ada', lastname='Okon',
            phone_number='08011112222', role='student',
            nin_hash='nin-hash-passport-001', password='x',
            passport=self._passport(),
        )
        return Student.objects.create(
            user=user, email=user.email, firstname='Ada', lastname='Okon')

    def test_detail_returns_user_passport_url(self):
        student = self._student_with_passport()
        resp = self.client.get(reverse('student-detail', kwargs={'pk': student.pk}))
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIsNotNone(resp.data['passport'])
        self.assertEqual(resp.data['passport'], student.user.passport.url)

    def test_detail_returns_null_when_user_has_no_passport(self):
        user = User.objects.create_user(
            email='no-photo@passport.test', firstname='No', lastname='Ph',
            phone_number='08022223333', role='student',
            nin_hash='nin-hash-passport-002', password='x', passport='',
        )
        student = Student.objects.create(
            user=user, email=user.email, firstname='No', lastname='Ph')
        resp = self.client.get(reverse('student-detail', kwargs={'pk': student.pk}))
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertIsNone(resp.data['passport'])

    def test_list_also_returns_user_passport(self):
        student = self._student_with_passport()
        resp = self.client.get(reverse('student-list'))
        self.assertEqual(resp.status_code, 200, resp.data)
        row = next(s for s in resp.data['results'] if str(s['user_id']) == str(student.pk))
        self.assertEqual(row['passport'], student.user.passport.url)

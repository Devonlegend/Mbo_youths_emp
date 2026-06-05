from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from accounts.models import User
from .serializers import normalize_details_payload


class ApplicationListRouteTests(TestCase):
    def test_list_route_returns_ok_without_serializer_error(self):
        user = User.objects.create_user(
            email='student@example.com',
            firstname='Student',
            lastname='One',
            phone_number='08000000000',
            role='student',
            nin_hash='1234567890',
            password='strong-pass123',
        )

        client = APIClient()
        client.force_authenticate(user=user)

        response = client.get('/applications/')

        self.assertEqual(response.status_code, 200)


class NormalizeDetailsPayloadTests(SimpleTestCase):
    def test_normalizes_legacy_scholarship_payload(self):
        payload = {
            "scheme_id": "scheme-123",
            "institution": "University of Lagos",
            "department": "Computer Science",
            "current_level": "300",
            "cgpa": "4.00",
            "matric_number": "12345",
            "bank_name": "Zenith Bank",
            "account_number": "1234567890",
            "account_name": "Jane Doe",
        }

        normalized = normalize_details_payload("scholarship", payload)

        self.assertEqual(normalized["institution_name"], "University of Lagos")
        self.assertEqual(normalized["course_of_study"], "Computer Science")
        self.assertEqual(normalized["current_level"], "300")
        self.assertEqual(normalized["cgpa"], "4.00")
        self.assertEqual(normalized["matric_number"], "12345")
        self.assertEqual(normalized["bank_name"], "Zenith Bank")

    def test_preserves_nested_details_payload(self):
        payload = {
            "details": {
                "institution_name": "UI",
                "course_of_study": "Engineering",
                "current_level": "400",
                "cgpa": "3.80",
                "matric_number": "ABC123",
            }
        }

        normalized = normalize_details_payload("scholarship", payload)

        self.assertEqual(normalized["institution_name"], "UI")
        self.assertEqual(normalized["course_of_study"], "Engineering")

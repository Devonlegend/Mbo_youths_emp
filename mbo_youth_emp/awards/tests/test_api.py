"""Awards API — endpoint-level contract.

Covers the student renewal path and the staff verification / disbursement
queue, plus the permission split (verify = verifier, disburse/suspend/terminate
= admin) and the CSV export.
"""

from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from awards.models import AwardStatus, InstallmentStatus
from awards.services.lifecycle import submit_renewal

from .base import AwardTestBase

TEST_STORAGES = {
    'default': {'BACKEND': 'django.core.files.storage.InMemoryStorage'},
    'staticfiles': {'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage'},
}


@override_settings(STORAGES=TEST_STORAGES)
class AwardApiTests(AwardTestBase):
    def setUp(self):
        self.client = APIClient()

    # ── Register (staff) ───────────────────────────────────────────────────
    def test_list_is_staff_only(self):
        award = self.make_award()
        self.client.force_authenticate(user=award.student)
        self.assertEqual(self.client.get(reverse('award-list')).status_code, 403)

        self.client.force_authenticate(user=self.make_staff('verifier'))
        resp = self.client.get(reverse('award-list'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['count'], 1)

    # ── Mine (student) ─────────────────────────────────────────────────────
    def test_mine_returns_own_awards_with_installments(self):
        award = self.make_award()
        self.client.force_authenticate(user=award.student)
        resp = self.client.get(reverse('award-mine'))
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data), 1)
        self.assertEqual(resp.data[0]['id'], str(award.id))
        self.assertEqual(len(resp.data[0]['installments']), 1)

    def test_mine_for_staff_without_profile_is_404(self):
        self.client.force_authenticate(user=self.make_staff('verifier'))
        self.assertEqual(self.client.get(reverse('award-mine')).status_code, 404)

    # ── Detail ─────────────────────────────────────────────────────────────
    def test_detail_owner_and_staff_and_other_student(self):
        award = self.make_award()
        url = reverse('award-detail', kwargs={'pk': award.pk})

        self.client.force_authenticate(user=award.student)
        self.assertEqual(self.client.get(url).status_code, 200)

        self.client.force_authenticate(user=self.make_student())
        self.assertEqual(self.client.get(url).status_code, 404)

        self.client.force_authenticate(user=self.make_staff('verifier'))
        self.assertEqual(self.client.get(url).status_code, 200)

    # ── Renew ──────────────────────────────────────────────────────────────
    def _award_with_open_renewal(self):
        award = self.make_award()
        self.add_installment(award, year_index=2,
                             status=InstallmentStatus.PENDING_RENEWAL)
        return award

    def test_renew_multipart_submits(self):
        award = self._award_with_open_renewal()
        self.client.force_authenticate(user=award.student)
        transcript = SimpleUploadedFile('result.pdf', b'%PDF-1.4 fake',
                                        content_type='application/pdf')
        resp = self.client.post(
            reverse('award-renew', kwargs={'pk': award.pk}),
            {'cgpa': '3.60', 'cgpa_scale': '5.0', 'level': '300',
             'transcript': transcript},
            format='multipart',
        )
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['status'], InstallmentStatus.PENDING_VERIFICATION)

    def test_renew_by_other_student_is_404(self):
        award = self._award_with_open_renewal()
        self.client.force_authenticate(user=self.make_student())
        resp = self.client.post(
            reverse('award-renew', kwargs={'pk': award.pk}),
            {'cgpa': '3.60', 'level': '300'}, format='multipart')
        self.assertEqual(resp.status_code, 404)

    def test_renew_with_no_open_installment_is_400(self):
        award = self.make_award()  # only year 1, already approved
        self.client.force_authenticate(user=award.student)
        resp = self.client.post(
            reverse('award-renew', kwargs={'pk': award.pk}),
            {'cgpa': '3.60', 'level': '300'}, format='multipart')
        self.assertEqual(resp.status_code, 400)

    # ── Verify / disburse ──────────────────────────────────────────────────
    def _submitted_installment(self):
        award = self.make_award()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.PENDING_RENEWAL,
                                    threshold='3.00')
        submit_renewal(award=award, student=award.student, cgpa='3.50',
                       level='300')
        inst.refresh_from_db()
        return award, inst

    def test_verify_requires_verifier(self):
        _award, inst = self._submitted_installment()
        url = reverse('award-installment-verify', kwargs={'pk': inst.pk})
        self.client.force_authenticate(user=self.make_student())
        self.assertEqual(
            self.client.post(url, {'action': 'approve'}).status_code, 403)

        self.client.force_authenticate(user=self.make_staff('verifier'))
        resp = self.client.post(url, {'action': 'approve'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['status'], InstallmentStatus.APPROVED)

    def test_disburse_requires_admin(self):
        award = self.make_award()
        inst = award.installments.get(year_index=1)
        url = reverse('award-installment-disburse', kwargs={'pk': inst.pk})

        self.client.force_authenticate(user=self.make_staff('verifier'))
        self.assertEqual(
            self.client.post(url, {}, format='json').status_code, 403)

        self.client.force_authenticate(user=self.make_staff('admin'))
        resp = self.client.post(url, {'disbursement_ref': 'PAY-1'}, format='json')
        self.assertEqual(resp.status_code, 200, resp.data)
        self.assertEqual(resp.data['status'], InstallmentStatus.DISBURSED)

    # ── Renewal queue ──────────────────────────────────────────────────────
    def test_renewals_queue_is_staff_only_and_lists_pending(self):
        _award, inst = self._submitted_installment()
        url = reverse('award-renewals')

        self.client.force_authenticate(user=self.make_student())
        self.assertEqual(self.client.get(url).status_code, 403)

        self.client.force_authenticate(user=self.make_staff('verifier'))
        resp = self.client.get(url)
        self.assertEqual(resp.status_code, 200)
        ids = [row['id'] for row in resp.data['results']]
        self.assertIn(str(inst.id), ids)

    # ── Export ─────────────────────────────────────────────────────────────
    def test_export_csv(self):
        award = self.make_award()
        self.client.force_authenticate(user=self.make_staff('verifier'))
        resp = self.client.get(reverse('award-export'), {'export': 'csv'})
        self.assertEqual(resp.status_code, 200)
        self.assertIn('text/csv', resp['Content-Type'])
        self.assertIn('attachment', resp['Content-Disposition'])
        self.assertIn(b'student_name', resp.content)
        self.assertIn(award.student.lastname.encode(), resp.content)

    # ── Admin overrides ────────────────────────────────────────────────────
    def test_suspend_and_terminate_admin_only(self):
        award = self.make_award()
        suspend = reverse('award-suspend', kwargs={'pk': award.pk})
        terminate = reverse('award-terminate', kwargs={'pk': award.pk})

        self.client.force_authenticate(user=self.make_staff('verifier'))
        self.assertEqual(
            self.client.post(suspend, {}, format='json').status_code, 403)

        self.client.force_authenticate(user=self.make_staff('admin'))
        resp = self.client.post(suspend, {'reason': 'review'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], AwardStatus.SUSPENDED)

        resp = self.client.post(terminate, {'reason': 'final'}, format='json')
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data['status'], AwardStatus.TERMINATED)

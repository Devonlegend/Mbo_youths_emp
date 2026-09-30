"""Award emails — template rendering + task resolution.

Runs with ZEPTO_MOCK_MODE on so `_send` renders the template and logs instead
of hitting the network. This is what catches a missing/broken template or a
context key typo.
"""

from django.test import override_settings

from awards.models import AppealStatus, AwardAppeal, InstallmentStatus
from awards.services.lifecycle import disburse_installment
from verification.services.email import EmailService
from verification.tasks import (
    send_award_renewal_open_email, send_appeal_decision_email,
)

from .base import AwardTestBase


@override_settings(ZEPTO_MOCK_MODE=True)
class AwardEmailTests(AwardTestBase):
    def test_renewal_open_email_renders(self):
        award = self.make_award()
        self.assertTrue(EmailService.send_renewal_open(award, self.next_cycle, 2))

    def test_award_suspended_email_renders(self):
        award = self.make_award()
        self.assertTrue(EmailService.send_award_suspended(award, 'CGPA below threshold'))

    def test_installment_disbursed_email_renders(self):
        award = self.make_award()
        installment = award.installments.get(year_index=1)
        disburse_installment(installment=installment,
                             admin=self.make_staff('admin'),
                             disbursement_ref='PAY-1')
        installment.refresh_from_db()
        self.assertTrue(EmailService.send_installment_disbursed(installment))

    def test_award_graduated_email_renders(self):
        award = self.make_award(total_years=1)
        self.assertTrue(EmailService.send_award_graduated(award))

    def test_appeal_decision_email_renders_both_outcomes(self):
        award = self.make_award()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.WITHHELD)
        for status in (AppealStatus.UPHELD, AppealStatus.REJECTED):
            appeal = AwardAppeal.objects.create(
                award=award, installment=inst, reason='x', status=status)
            self.assertTrue(EmailService.send_appeal_decision(appeal))

    def test_renewal_open_task_resolves_award_and_cycle(self):
        award = self.make_award()
        # Eager in-process run — validates the task's id resolution path.
        send_award_renewal_open_email.apply(
            kwargs={'award_id': str(award.id),
                    'cycle_id': str(self.next_cycle.id),
                    'year_index': 2},
            throw=True)

    def test_appeal_decision_task_resolves(self):
        award = self.make_award()
        inst = self.add_installment(award, year_index=2,
                                    status=InstallmentStatus.WITHHELD)
        appeal = AwardAppeal.objects.create(award=award, installment=inst, reason='x')
        send_appeal_decision_email.apply(
            kwargs={'appeal_id': str(appeal.id)}, throw=True)

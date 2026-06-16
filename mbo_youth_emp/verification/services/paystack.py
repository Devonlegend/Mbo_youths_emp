import requests
from django.conf import settings


class PaystackVerificationService:
    """
    Verifies a bank account number using the Paystack API.
    Resolves the account to get the registered name,
    then matches it against the student's full name.

    Usage:
        result = PaystackVerificationService.resolve_account("0123456789", "058")
        if result["success"]:
            print(result["account_name"])

        match = PaystackVerificationService.name_match("EFFIONG MONDAY AMOS", "Effiong M. Amos")
        print(match["passed"])  # True
    """

    BASE_URL = "https://api.paystack.co"

    @classmethod
    def resolve_account(cls, account_number: str, bank_code: str) -> dict:
        if settings.PAYSTACK_MOCK_MODE:
            return cls._mock_resolve(account_number, bank_code)
        return cls._real_resolve(account_number, bank_code)

    @classmethod
    def _real_resolve(cls, account_number: str, bank_code: str) -> dict:
        try:
            response = requests.get(
                f"{cls.BASE_URL}/bank/resolve",
                headers={
                    "Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"
                },
                params={
                    "account_number": account_number,
                    "bank_code":      bank_code,
                },
                timeout=10
            )
            data = response.json()

            if data.get("status"):
                return {
                    "success":      True,
                    "account_name": data["data"]["account_name"],
                    "account_number": data["data"]["account_number"],
                    "bank_id":      data["data"]["bank_id"],
                    "error":        None,
                }

            return {
                "success": False,
                "error":   data.get("message", "Account resolution failed")
            }

        except requests.exceptions.Timeout:
            return {"success": False, "error": "Paystack API timed out"}
        except requests.exceptions.RequestException as e:
            return {"success": False, "error": str(e)}

    @classmethod
    def _mock_resolve(cls, account_number: str, bank_code: str) -> dict:
        """
        Returns a fake account name based on the account number.
        Last digit determines which mock name is returned.
        """
        mock_names = [
            "EFFIONG MONDAY AMOS",
            "AKATA BLESSING UNYIME",
            "UDOSEN GRACE ETENIMI",
            "OKON SAMUEL DAVID",
            "ETIM PATIENCE ANIEKAN",
            "INYANG JOSEPH AKPAN",
            "AKPAN VICTOR OKON",
            "UDO MARY INIABASI",
            "BASSEY DANIEL EKONG",
            "EDET PRISCILLA SUNDAY",
        ]
        idx  = int(account_number[-1]) % len(mock_names)
        name = mock_names[idx]

        return {
            "success":        True,
            "account_name":   name,
            "account_number": account_number,
            "bank_id":        1,
            "error":          None,
            "_mock":          True,
        }

    @classmethod
    def name_match(cls, registered_name: str, application_name: str) -> dict:
        """
        Fuzzy match the bank-registered name against the application name.
        Uses token overlap — handles middle name variations gracefully.

        A score of 0.6 (60% token overlap) is the minimum to pass.
        """
        def tokenise(name: str) -> set:
            return set(name.upper().strip().split())

        reg_tokens = tokenise(registered_name)
        app_tokens = tokenise(application_name)

        if not reg_tokens or not app_tokens:
            return {"passed": False, "score": 0.0, "detail": "Empty name"}

        overlap    = reg_tokens & app_tokens
        total      = max(len(reg_tokens), len(app_tokens))
        score      = len(overlap) / total

        passed = score >= 0.6

        return {
            "passed":          passed,
            "score":           round(score, 2),
            "overlap_tokens":  list(overlap),
            "detail": (
                f"Matched {len(overlap)} of {total} name tokens"
                if passed else
                f"Only {len(overlap)} of {total} tokens matched — below 60% threshold"
            )
        }

    @classmethod
    def get_banks(cls) -> list:
        """Fetch list of Nigerian banks from Paystack."""
        if settings.PAYSTACK_MOCK_MODE:
            return cls._mock_banks()

        try:
            response = requests.get(
                f"{cls.BASE_URL}/bank",
                headers={"Authorization": f"Bearer {settings.PAYSTACK_SECRET_KEY}"},
                params={"country": "nigeria", "per_page": 100},
                timeout=10
            )
            data = response.json()
            if data.get("status"):
                return [{"name": b["name"], "code": b["code"]} for b in data["data"]]
        except Exception:
            pass

        return cls._mock_banks()

    @staticmethod
    def _mock_banks() -> list:
        return [
            {"name": "Access Bank",         "code": "044"},
            {"name": "First Bank",          "code": "011"},
            {"name": "GTBank",              "code": "058"},
            {"name": "UBA",                 "code": "033"},
            {"name": "Zenith Bank",         "code": "057"},
            {"name": "Fidelity Bank",       "code": "070"},
            {"name": "Keystone Bank",       "code": "082"},
            {"name": "Sterling Bank",       "code": "232"},
            {"name": "Union Bank",          "code": "032"},
            {"name": "Wema Bank",           "code": "035"},
        ]

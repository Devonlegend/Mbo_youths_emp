from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, inline_serializer

from .services.paystack import PaystackVerificationService


@extend_schema(
    summary="Resolve a bank account",
    description=(
        "Resolves an account name via Paystack and fuzzy-matches it against the "
        "student's registered name. Call before submitting an application."
    ),
    request=inline_serializer(
        name='ResolveBankRequest',
        fields={
            'account_number': serializers.CharField(help_text='Exactly 10 digits.'),
            'bank_code': serializers.CharField(),
        },
    ),
    responses=OpenApiResponse(description=(
        '{ success, account_name, account_number, name_match: {passed, score, '
        'overlap_tokens, detail}, warning }'
    )),
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_bank_account(request):
    """
    POST /verification/bank/
    Body: { "account_number": "0123456789", "bank_code": "058" }

    Resolves the account name and checks it matches the student's name.
    """
    account_number = request.data.get('account_number', '').strip()
    bank_code      = request.data.get('bank_code', '').strip()

    if not account_number or not bank_code:
        return Response({"error": "account_number and bank_code are required"}, status=400)

    if len(account_number) != 10 or not account_number.isdigit():
        return Response({"error": "Account number must be exactly 10 digits"}, status=400)

    # Resolve the account
    result = PaystackVerificationService.resolve_account(account_number, bank_code)

    if not result["success"]:
        return Response({"error": result["error"]}, status=400)

    # Name match against the student's registered name
    name_check = {}
    try:
        student    = request.user.student_profile
        name_check = PaystackVerificationService.name_match(
            result["account_name"],
            student.full_name
        )
    except Exception:
        name_check = {"passed": False, "detail": "No student profile found"}

    return Response({
        "success": True,
        "account_name": result["account_name"],
        "account_number": result["account_number"],
        "name_match": name_check,
        "warning": (
            None if name_check.get("passed") else
            f"Name mismatch: bank shows '{result['account_name']}' "
            f"but your profile shows '{getattr(getattr(request.user, 'student_profile', None), 'full_name', 'unknown')}'. "
            f"An admin will review this manually."
        )
    })


@extend_schema(
    summary="List banks",
    description='Nigerian banks for the account dropdown.',
    responses=OpenApiResponse(description='{ banks: [{ name, code }] }'),
)
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_banks(request):
    """GET /verification/banks/ — list of Nigerian banks for the dropdown."""
    banks = PaystackVerificationService.get_banks()
    return Response({"banks": banks})

from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema, OpenApiResponse, inline_serializer
import cloudinary.uploader
from .services.paystack import PaystackVerificationService


@extend_schema(
    summary="Resolve a bank account",
    description=(
        "Resolves an account name via Paystack and fuzzy-matches it against the "
        "student's registered name. Saves verified details to the student's profile. "
        "Call before submitting an application."
    ),
    request=inline_serializer(
        name='ResolveBankRequest',
        fields={
            'account_number': serializers.CharField(help_text='Exactly 10 digits.'),
            'bank_code': serializers.CharField(),
        },
    ),
    responses=OpenApiResponse(description=(
        '{ success, account_name, account_number, bank_name, bank_code, '
        'name_match: {passed, score, overlap_tokens, detail}, warning }'
    )),
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def resolve_bank_account(request):
    """
    POST /verification/bank/
    Body: { "account_number": "0123456789", "bank_code": "058" }

    Resolves the account name via Paystack, checks it matches the student's
    registered name, and saves the verified details to the student's profile.
    Returns bank_name and bank_code so the frontend can update local state.
    """
    account_number = request.data.get('account_number', '').strip()
    bank_code      = request.data.get('bank_code', '').strip()

    if not account_number or not bank_code:
        return Response({"error": "account_number and bank_code are required"}, status=400)

    if len(account_number) != 10 or not account_number.isdigit():
        return Response({"error": "Account number must be exactly 10 digits"}, status=400)

    # Resolve the account via Paystack
    result = PaystackVerificationService.resolve_account(account_number, bank_code)

    if not result["success"]:
        return Response({"error": result["error"]}, status=400)

    # Derive bank_name from bank_code server-side — frontend never sends it
    bank_name = ""
    try:
        banks     = PaystackVerificationService.get_banks()
        bank_map  = {b['code']: b['name'] for b in banks}
        bank_name = bank_map.get(bank_code, "")
    except Exception:
        # Non-fatal — leave bank_name blank rather than crashing
        bank_name = ""

    # Name match against the student's registered name
    # FIX: related_name is 'student', not 'student_profile'
    student    = getattr(request.user, 'student', None)
    name_check = {}

    if student:
        name_check = PaystackVerificationService.name_match(
            result["account_name"],
            student.full_name,
        )
    else:
        name_check = {"passed": False, "detail": "No student profile found"}

    # Persist verified details to the Student row
    # FIX: was using request.user.student_profile (wrong) in a try/except that
    # silently swallowed the AttributeError — nothing was ever actually saved.
    if student:
        try:
            student.bank_name           = bank_name
            student.bank_code           = bank_code
            student.bank_account_number = account_number
            student.bank_account_name   = result["account_name"]
            student.save()
        except Exception:
            # Non-fatal — the application submit still carries the values
            pass

    return Response({
        "success":        True,
        "account_name":   result["account_name"],
        "account_number": result["account_number"],
        "bank_name":      bank_name,
        "bank_code":      bank_code,
        "name_match":     name_check,
        "warning": (
            None if name_check.get("passed") else
            f"Name mismatch: bank shows '{result['account_name']}' "
            f"but your profile shows '{getattr(student, 'full_name', 'unknown')}'. "
            f"An admin will review this manually."
        ),
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


@extend_schema(
    summary="Upload a document",
    description="Accepts a file, uploads it to Cloudinary, and returns the URL. Use before submitting an application.",
    responses=OpenApiResponse(description='{ url }'),
)
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_document(request):
    """
    POST /verification/upload/
    Body: multipart/form-data with a 'file' field.
    Returns: { url: 'https://res.cloudinary.com/...' }
    """
    file = request.FILES.get('file')
    if not file:
        return Response({"error": "No file provided."}, status=400)

    if file.size > 5 * 1024 * 1024:
        return Response({"error": "File must not exceed 5MB."}, status=400)

    allowed_types = ['image/jpeg', 'image/png', 'application/pdf']
    if file.content_type not in allowed_types:
        return Response({"error": "Only JPEG, PNG, and PDF files are allowed."}, status=400)

    try:
        result = cloudinary.uploader.upload(
            file,
            folder="mbo_documents",
            resource_type="auto",
        )
        return Response({"url": result["secure_url"]})
    except Exception as e:
        return Response({"error": "Upload failed. Please try again."}, status=500)
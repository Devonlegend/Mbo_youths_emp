from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.token_blacklist.models import OutstandingToken, BlacklistedToken
from django.contrib.auth import get_user_model
from students.models import Student

User = get_user_model()


@api_view(['POST'])
@permission_classes([AllowAny])
def register(request):
    """
    POST /auth/register/
    Body: { email, phone_number, password, role }
    """
    email        = request.data.get('email')
    firstname    = request.data.get('firstname')
    lastname     = request.data.get('lastname')
    phone_number = request.data.get('phone_number')
    password     = request.data.get('password')
    role         = request.data.get('role', 'student')
    nin_hash     = request.data.get('nin_hash')  

    passport  = request.FILES.get('passport')
    certificate       = request.FILES.get('certificate')
    

    # Validation
    if not all([email, firstname, lastname, phone_number, password, nin_hash]):
        return Response({"error": "All fields are required"},
                        status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email=email).exists():
        return Response({"error": "Email already registered"},
                        status=status.HTTP_400_BAD_REQUEST)

  
    if role not in ['student']:
        return Response({"error": "Invalid role for self-registration"},
                        status=status.HTTP_403_FORBIDDEN)

    user = Student.objects.create_user(
        email=email,
        phone_number=phone_number,
        role=role,
        password=password,
        firstname=firstname,
        lastname=lastname,
        nin_hash=nin_hash
    )

    if passport:
        user.passport = passport
    if certificate:
        user.certificate = certificate
    if passport or certificate:
        user.save()

    # Generate tokens immediately so they're logged in after registering
    refresh = RefreshToken.for_user(user)

    return Response({
        "message": "Account created successfully",
        "role":    user.role,
        "tokens": {
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
        }
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def login(request):
    """
    POST /auth/login/
    Body: { email, password }
    """
    from django.contrib.auth import authenticate

    email    = request.data.get('email')
    password = request.data.get('password')

    user = authenticate(request, username=email, password=password)

    if not user:
        return Response({"error": "Invalid email or password"},
                        status=status.HTTP_401_UNAUTHORIZED)

    refresh = RefreshToken.for_user(user)

    return Response({
        "role":  user.role,
        "email": user.email,
        "tokens": {
            "access":  str(refresh.access_token),
            "refresh": str(refresh),
        }
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def me(request):
    """GET /auth/me/ — who am I?"""
    return Response({
        "id":           str(request.user.id),
        "email":        request.user.email,
        "firstname":    request.user.firstname,
        "lastname":     request.user.lastname,
        "phone_number": request.user.phone_number,
        "role":         request.user.role,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def logout(request):
    """POST /auth/logout/ — invalidate the refresh token"""
    try:
        refresh_token = request.data["refresh"]
        token = RefreshToken(refresh_token)
        token.blacklist()  # This will mark the token as blacklisted
        return Response({"message": "Logged out successfully"})
    except Exception as e:
        return Response({"error": "Invalid token"}, status=status.HTTP_400_BAD_REQUEST)
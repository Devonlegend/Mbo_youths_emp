from rest_framework import serializers
from .models import Student





class StudentSerializer(serializers.ModelSerializer):
    
    has_active_award = serializers.SerializerMethodField()
    # The passport lives on the linked User (accounts.User.passport), set at
    # registration. The legacy Student.passport column is never populated, so we
    # surface the User's photo under the same `passport` key for the admin
    # verification screens.
    passport = serializers.SerializerMethodField()

    class Meta:
        model  = Student
        fields = [
            'user_id', 'email', 'firstname', 'lastname', 'phone_number', 'ward','nin_slip', 'lga',
            'is_verified','gender', 'certificate','passport',
            'active_award', 'has_active_award',
        ]

    def get_has_active_award(self, obj) -> bool:
        return obj.has_active_award()

    def get_passport(self, obj):
        user = getattr(obj, 'user', None)
        if user is not None and user.passport:
            return user.passport.url
        return None


class StudentCreateSerializer(serializers.ModelSerializer):
    """Used only when creating a new student profile.

    nin_hash is intentionally NOT writable here: it is derived server-side from the
    raw NIN at registration (accounts.utils.hash_nin) and mirrored onto the Student.
    Exposing it as an input would let a caller set an arbitrary, unverified hash.
    """
    class Meta:
        model  = Student
        fields = [
            'firstname', 'lastname', 'ward', 'lga',
            'active_award',
        ]
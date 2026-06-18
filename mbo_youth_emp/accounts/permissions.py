from rest_framework.permissions import BasePermission


class IsStudent(BasePermission):
    def has_permission(self, request, view):
        return (request.user.is_authenticated and
                request.user.role == 'student')


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return (request.user.is_authenticated and
                request.user.role in ['admin', 'superadmin'])


class IsSuperAdmin(BasePermission):
    """Allows access only to users with role == 'superadmin'."""
    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == 'superadmin'
        )
 


class IsVerifier(BasePermission):
    def has_permission(self, request, view):
        return (request.user.is_authenticated and
                request.user.role in ['verifier', 'admin', 'superadmin'])


class IsDonor(BasePermission):
    def has_permission(self, request, view):
        return (request.user.is_authenticated and
                request.user.role in ['donor', 'admin', 'superadmin'])
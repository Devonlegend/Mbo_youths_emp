from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import Notification

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_notifications(request):
    notifs = Notification.objects.filter(user=request.user)
    data = [
        {
            "id":         str(n.id),
            "type":       n.type,
            "title":      n.title,
            "message":    n.message,
            "read":       n.read,
            "time":       n.created_at.isoformat(),
        }
        for n in notifs
    ]
    return Response(data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_read(request, id):
    try:
        notif = Notification.objects.get(id=id, user=request.user)
        notif.read = True
        notif.save(update_fields=['read'])
        return Response({"message": "Marked as read"})
    except Notification.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def mark_all_read(request):
    Notification.objects.filter(user=request.user, read=False).update(read=True)
    return Response({"message": "All marked as read"})

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def dismiss(request, id):
    try:
        notif = Notification.objects.get(id=id, user=request.user)
        notif.delete()
        return Response({"message": "Dismissed"})
    except Notification.DoesNotExist:
        return Response({"error": "Not found"}, status=status.HTTP_404_NOT_FOUND)

@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def clear_all(request):
    Notification.objects.filter(user=request.user).delete()
    return Response({"message": "All cleared"})
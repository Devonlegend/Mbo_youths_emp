
from django.http import JsonResponse
from .models import Student

def students_list(request):
    students = Student.object.all()

    data = []
    for student in students:
        data.append({
            "id": str(student.id),
            "full_name": student.full_name,
            "ward": student.ward,
            "level": student.level,
            "cgpa": float(student.cgpa) if student.cgpa else None,
            "is_verified": student.is_verified,
        })
    return JsonResponse({students:data})

def student_detail(request, student_id):
    try:
        student = Student.object.get(id = student_id)
    except Student.DoesNotExist:
        return JsonResponse({"errer":"Student not found"}, status=404)
    
    data ={
        "id": str(student.id),
        "full_name": student.full_name,
        "ward": student.ward,
        "level": student.level,
        "cgpa": float(student.cgpa) if student.cgpa else None,
        "is_verified": student.is_verified,
        "has_active_award":student.has_active_award(),
        "active_award": student.active_award,
    }

    return JsonResponse(data)
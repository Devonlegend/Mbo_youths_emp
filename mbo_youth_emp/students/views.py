
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

from django.http import JsonResponse
from .models import Student

def check_eligibility(request, student_id):
  
    student = Student.objects.filter(id=student_id).first()
    if not student:
        return JsonResponse({"error": "Student not found"}, status=404)

    # Get scheme rules from the URL query parameters
    try:
        min_cgpa      = float(request.GET.get("min_cgpa", 2.20))
        required_level = request.GET.get("level", "")
    except ValueError:
        return JsonResponse({"error": "Invalid parameters"}, status=400)

    student_cgpa = float(student.cgpa) if student.cgpa else 0.0
    cgpa_passed  = student_cgpa >= min_cgpa
    level_passed = (student.level == required_level) if required_level else True
    has_conflict = student.has_active_award()
    eligible = cgpa_passed and level_passed and not has_conflict

    return JsonResponse({
        "student":    student.full_name,
        "ward":       student.ward,
        "eligible":   eligible,
        "checks": {
            "cgpa": {
                "passed":             cgpa_passed,
                "student_cgpa":       student_cgpa,
               
            },
            "level": {
                "passed":         level_passed,
                "student_level":  student.level,
                "required_level": required_level,
            },
            "conflict": {
                "has_conflict":  has_conflict,
                "active_award":  student.active_award,
            }
        }
    })
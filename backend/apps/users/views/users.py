from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.users.models import User
from apps.users.serializers import UserSerializer


class UserList(APIView):

    def get(self, request):

        users = User.objects.all()

        serializer = UserSerializer(
            users,
            many=True
        )

        return Response(serializer.data)


class CurrentUser(APIView):

    permission_classes = [IsAuthenticated]

    def get(self, request):

        serializer = UserSerializer(request.user)

        return Response(serializer.data) 
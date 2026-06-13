from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from .models import AccountProfile


User = get_user_model()


class AccountSerializer(serializers.ModelSerializer):
    name = serializers.CharField(source="first_name", read_only=True)
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "name", "email", "photo_url"]

    def get_photo_url(self, user):
        try:
            photo = user.profile.photo
        except AccountProfile.DoesNotExist:
            return ""
        return photo.url if photo else ""


class RegisterSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_email(self, value: str) -> str:
        email = value.strip()
        email_exists = User.objects.filter(email__iexact=email).exists()
        username_exists = User.objects.filter(username__iexact=email).exists()
        if email_exists or username_exists:
            raise serializers.ValidationError("Пользователь с такой почтой уже существует.")
        return email

    def validate_password(self, value: str) -> str:
        validate_password(value)
        return value

    def create(self, validated_data):
        return User.objects.create_user(
            username=validated_data["email"],
            email=validated_data["email"],
            password=validated_data["password"],
            first_name=validated_data.get("name", "").strip(),
        )


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate(self, attrs):
        email = attrs["email"].strip()
        user_by_email = User.objects.filter(email__iexact=email).first()
        username = user_by_email.get_username() if user_by_email is not None else email

        user = authenticate(
            request=self.context.get("request"),
            username=username,
            password=attrs["password"],
        )
        if user is None:
            raise serializers.ValidationError("Неверная почта или пароль.")
        if not user.is_active:
            raise serializers.ValidationError("Аккаунт отключён.")

        attrs["user"] = user
        return attrs


class AccountUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=150, allow_blank=True, required=False)
    email = serializers.EmailField(required=False)
    photo = serializers.FileField(write_only=True, required=False, allow_empty_file=False)
    remove_photo = serializers.BooleanField(write_only=True, required=False, default=False)

    def validate_email(self, value: str) -> str:
        email = value.strip()
        user = self.context["request"].user
        email_exists = User.objects.filter(email__iexact=email).exclude(pk=user.pk).exists()
        username_exists = User.objects.filter(username__iexact=email).exclude(pk=user.pk).exists()
        if email and (email_exists or username_exists):
            raise serializers.ValidationError("Пользователь с такой почтой уже существует.")
        return email

    def validate_photo(self, value):
        content_type = getattr(value, "content_type", "")
        if content_type and not content_type.startswith("image/"):
            raise serializers.ValidationError("Загрузите файл изображения.")
        if value.size > 5 * 1024 * 1024:
            raise serializers.ValidationError("Файл должен быть меньше 5 МБ.")
        return value

    def save(self, **kwargs):
        user = self.context["request"].user
        profile, _ = AccountProfile.objects.get_or_create(user=user)

        if "name" in self.validated_data:
            user.first_name = self.validated_data["name"].strip()
        if "email" in self.validated_data:
            user.email = self.validated_data["email"].strip()
            user.username = user.email
        user.save()

        if self.validated_data.get("remove_photo") and profile.photo:
            profile.photo.delete(save=False)
            profile.photo = ""
        if "photo" in self.validated_data:
            if profile.photo:
                profile.photo.delete(save=False)
            profile.photo = self.validated_data["photo"]
        profile.save()
        return user


class PasswordChangeSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_current_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Текущий пароль указан неверно.")
        return value

    def validate_new_password(self, value: str) -> str:
        validate_password(value, user=self.context["request"].user)
        return value

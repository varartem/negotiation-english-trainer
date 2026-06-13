import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { api, resolveBackendUrl } from "../api/client";
import type { AccountUser } from "../types";

interface AccountPageProps {
  user: AccountUser;
  onUserChange: (user: AccountUser) => void;
  onLogout: () => void;
}

export default function AccountPage({ user, onUserChange, onLogout }: AccountPageProps) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [photo, setPhoto] = useState<File | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    setName(user.name);
    setEmail(user.email);
  }, [user.email, user.name]);

  const photoPreview = useMemo(() => {
    if (photo) {
      return URL.createObjectURL(photo);
    }
    return removePhoto ? "" : resolveBackendUrl(user.photo_url);
  }, [photo, removePhoto, user.photo_url]);

  useEffect(() => {
    return () => {
      if (photoPreview.startsWith("blob:")) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const nextPhoto = event.target.files?.[0] ?? null;
    setPhoto(nextPhoto);
    setRemovePhoto(false);
  }

  async function handleProfileSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingProfile(true);
    setProfileError(null);
    setProfileSuccess(null);

    const formData = new FormData();
    formData.append("name", name.trim());
    formData.append("email", email.trim());
    if (photo) {
      formData.append("photo", photo);
    }
    if (removePhoto) {
      formData.append("remove_photo", "true");
    }

    try {
      const updatedUser = await api.updateAccount(formData);
      setPhoto(null);
      setRemovePhoto(false);
      setProfileSuccess("Профиль обновлён");
      onUserChange(updatedUser);
    } catch (error) {
      setProfileError(error instanceof Error ? error.message : "Не удалось обновить профиль");
    } finally {
      setIsSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSavingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      const updatedUser = await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setPasswordSuccess("Пароль изменён");
      onUserChange(updatedUser);
    } catch (error) {
      setPasswordError(error instanceof Error ? error.message : "Не удалось изменить пароль");
    } finally {
      setIsSavingPassword(false);
    }
  }

  return (
    <section className="account-page">
      <div className="account-content">
        <div className="section-heading">
          <h1>Аккаунт</h1>
        </div>

        <form className="account-panel" onSubmit={handleProfileSubmit}>
          <div className="account-photo-row">
            <div className="account-avatar account-avatar-large">
              {photoPreview ? <img src={photoPreview} alt="" /> : <span>{avatarInitial(user)}</span>}
            </div>
            <div className="account-photo-actions">
              <label className="secondary-button file-button">
                <input type="file" accept="image/*" onChange={handlePhotoChange} />
                <span>Выбрать фото</span>
              </label>
              {photoPreview ? (
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() => {
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                >
                  Удалить фото
                </button>
              ) : null}
            </div>
          </div>

          <div className="form-grid account-form-grid">
            <label className="field">
              <span>Имя</span>
              <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
            </label>
            <label className="field">
              <span>Почта</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
              />
            </label>
          </div>

          {profileError ? <p className="error-box">{profileError}</p> : null}
          {profileSuccess ? <p className="success-box">{profileSuccess}</p> : null}

          <div className="account-actions">
            <button className="primary-button" type="submit" disabled={isSavingProfile}>
              {isSavingProfile ? "Сохраняю..." : "Сохранить"}
            </button>
            <button className="secondary-button" type="button" onClick={onLogout}>
              Выйти
            </button>
          </div>
        </form>

        <form className="account-panel" onSubmit={handlePasswordSubmit}>
          <div className="section-heading">
            <h2>Пароль</h2>
          </div>
          <div className="form-grid account-form-grid">
            <label className="field">
              <span>Текущий пароль</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <label className="field">
              <span>Новый пароль</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>
          </div>

          {passwordError ? <p className="error-box">{passwordError}</p> : null}
          {passwordSuccess ? <p className="success-box">{passwordSuccess}</p> : null}

          <div className="account-actions">
            <button className="primary-button" type="submit" disabled={isSavingPassword}>
              {isSavingPassword ? "Сохраняю..." : "Сменить пароль"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function avatarInitial(user: AccountUser) {
  return (user.name || user.email || "N").trim().slice(0, 1).toUpperCase();
}

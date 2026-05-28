"use client";

import { updateProfile } from "firebase/auth";
import { getDownloadURL, ref, uploadBytesResumable } from "firebase/storage";
import { useState } from "react";
import { getClientAuth, getClientStorage } from "@/firebase/client";

export function AvatarUpload({ uid }: { uid: string }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Images only");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError("Max 2MB");
      return;
    }

    setUploading(true);
    setProgress(0);

    const storageRef = ref(getClientStorage(), `avatars/${uid}/${Date.now()}_${file.name}`);
    const task = uploadBytesResumable(storageRef, file);

    task.on(
      "state_changed",
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => {
        console.error(err);
        setError(err.message);
        setUploading(false);
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        const auth = getClientAuth();
        if (auth.currentUser) {
          await updateProfile(auth.currentUser, { photoURL: url });
        }
        await fetch("/api/user/avatar", {
          method: "POST",
          body: JSON.stringify({ photoURL: url }),
          headers: { "Content-Type": "application/json" },
        });
        setUploading(false);
        window.location.reload();
      },
    );
  }

  return (
    <label className="cursor-pointer inline-flex items-center gap-2">
      <input type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <span className="text-sm text-blue-600 hover:underline">
        {uploading ? `Uploading ${progress}%...` : "Change photo"}
      </span>
      {error && <span className="text-xs text-red-500">{error}</span>}
    </label>
  );
}

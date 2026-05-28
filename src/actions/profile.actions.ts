"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth.server";
import { updateUserDisplayName } from "@/lib/user.server";

export type ProfileFormState =
  | { errors?: Record<string, string[]>; success?: false }
  | { success: true }
  | null;

const ProfileSchema = z.object({
  displayName: z.string().trim().min(1, "Display name is required").max(60),
});

export async function updateProfileAction(
  _prevState: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const user = await requireUser();

  const parsed = ProfileSchema.safeParse({
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  await updateUserDisplayName(user.uid, parsed.data.displayName);

  revalidatePath("/profile");
  revalidatePath("/members");
  revalidatePath("/dashboard");
  return { success: true };
}

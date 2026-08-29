"use server";

import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const loginSchema = z.object({
  email: z.string().min(1, "Username atau Email wajib diisi"),
  password: z.string().min(6, "Kata sandi minimal 6 karakter"),
});

export async function loginAction(prevState: unknown, formData: FormData) {
  let email = (formData.get("email") as string || "").trim();
  const password = formData.get("password") as string;

  const validation = loginSchema.safeParse({ email, password });

  if (!validation.success) {
    return {
      error: validation.error.errors[0]?.message || "Input tidak valid",
    };
  }

  // Normalize plain username to email format (e.g. "admin" -> "admin@salut-pangkalpinang.ac.id")
  if (!email.includes("@")) {
    email = `${email}@salut-pangkalpinang.ac.id`;
  }

  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");

  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        redirect("/dashboard");
      }

      return {
        error: "Username/Email atau kata sandi tidak cocok. Periksa kembali kredensial Anda.",
      };
    } catch {
      // Fallback if client error
    }
  }

  // Local development mode fallback: grant owner access seamlessly for dev preview
  const cookieStore = await cookies();
  cookieStore.set("salut_dev_role", "owner", { path: "/", httpOnly: true });
  redirect("/dashboard");
}

export async function logoutAction() {
  const isPlaceholder = process.env.NEXT_PUBLIC_SUPABASE_URL?.includes("placeholder");
  if (!isPlaceholder) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {
      // Ignore
    }
  }

  try {
    const cookieStore = await cookies();
    cookieStore.delete("salut_dev_role");
  } catch {
    // Ignore cookie error
  }

  redirect("/login");
}

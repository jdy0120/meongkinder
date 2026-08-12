import React from "react";
import { redirect } from "next/navigation";

import { ProfilePage } from "@/views";
import { getMe } from "../layout";

export default async function Page() {
  const response = await getMe();
  if (!response.ok) {
    redirect("/auth/login");
  }
  const data = await response.json();

  return <ProfilePage user={data.data.user} />;
}

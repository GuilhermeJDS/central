import { redirect } from "next/navigation";

import { instalado } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function Inicio() {
  redirect((await instalado()) ? "/central" : "/instalar");
}

import { createClient } from "@/lib/supabase/server";
import { checkLegalAiAccess } from "@/lib/legal-ai/gate";
import { LegalAiGate } from "@/components/legal-ai/gate-banner";
import UploadForm from "./upload-form";

export const dynamic = "force-dynamic";

/**
 * Server-side gate for the Legal-AI upload page.
 * Renders the upload form only if the user has the Legal-AI add-on
 * (or premium tier). Otherwise shows an upgrade CTA.
 */
export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const access = await checkLegalAiAccess(user?.id);

  if (!access.allowed) {
    return <LegalAiGate access={access} />;
  }

  return <UploadForm />;
}

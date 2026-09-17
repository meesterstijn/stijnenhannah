import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useGameNightAnalytics } from "@/features/game-night/hooks/useGameNightAnalytics";
import { useCharacterParts } from "@/features/game-night/hooks/useCharacterCatalog";
import { useUpdateMyFace } from "@/features/game-night/hooks/useGameNightFace";
import {
  uploadPlayerFaceAsset,
  uploadPlayerFaceOriginal,
} from "@/features/game-night/lib/gameNightFaceStorage";
import { FacePhotoEditor } from "@/features/game-night/components/FacePhotoEditor";
import { GnV2Loading } from "@/features/game-night/v2/GnV2Loading";
import { GnV2Scene } from "@/features/game-night/v2/GnV2Scene";

export default function GameNightFaceSetup() {
  const navigate = useNavigate();
  const { session } = useAuth();
  const { data: analyticsData, isLoading } = useGameNightAnalytics();
  const { data: characterParts = [] } = useCharacterParts();
  const updateFace = useUpdateMyFace();
  const player = analyticsData?.players.find(
    (p) => p.auth_user_id === session?.user.id,
  );
  const back = () => navigate("/game-night/me");
  if (isLoading) return <GnV2Loading />;
  if (!player)
    return (
      <GnV2Scene className="gnv2-creator-scene">
        <div className="gnv2-creator-empty">
          <p>Dit account is nog niet gekoppeld aan een spelersprofiel.</p>
          <button
            type="button"
            onClick={back}
            className="gnv2-btn gnv2-btn-ghost"
          >
            Terug
          </button>
        </div>
      </GnV2Scene>
    );
  return (
    <FacePhotoEditor
      player={player}
      bodyPreviewPart={characterParts.find((p) => p.slot === "base")}
      onCancel={back}
      onSave={async ({ original, faceBlob, faceCrop }) => {
        const uploadedOriginal = await uploadPlayerFaceOriginal(
          player.id,
          original.blob,
          original.mimeType,
          original.extension,
        );
        const uploadedFace = await uploadPlayerFaceAsset(player.id, faceBlob);
        await updateFace.mutateAsync({
          faceOriginalPath: uploadedOriginal.storagePath,
          faceAssetPath: uploadedFace.storagePath,
          faceCrop,
        });
        back();
      }}
    />
  );
}

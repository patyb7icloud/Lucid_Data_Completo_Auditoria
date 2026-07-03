import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function Audit() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (params.sessionId) {
      navigate(`/auditoria/report/${params.sessionId}`);
    } else {
      navigate("/auditoria/connect");
    }
  }, [params.sessionId, navigate]);
  return null;
}

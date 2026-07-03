import { useEffect } from "react";
import { useLocation, useParams } from "wouter";

export default function Audit() {
  const params = useParams<{ sessionId: string }>();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (params.sessionId) navigate(`/dashboard/${params.sessionId}`);
  }, [params.sessionId]);
  return null;
}

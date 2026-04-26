import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const NotFound = () => (
  <div className="min-h-screen grid-bg flex items-center justify-center p-6 text-center">
    <div>
      <div className="text-8xl font-bold glow-text mb-4">404</div>
      <p className="text-muted-foreground mb-6">This page doesn't exist.</p>
      <Button asChild variant="hero"><Link to="/">Back to home</Link></Button>
    </div>
  </div>
);
export default NotFound;

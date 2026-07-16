import type { PropsWithChildren } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface AuthShellProps extends PropsWithChildren {
  readonly description: string;
  readonly title: string;
}

export function AuthShell({ children, description, title }: AuthShellProps) {
  return (
    <main className="auth-page flex min-h-svh w-full items-center justify-center px-4 sm:px-6">
      <div className="w-full max-w-md">
        <p className="mb-4 text-center text-xs font-semibold tracking-[0.16em] text-primary uppercase">
          Avventura AI
        </p>
        <Card className="gap-0 border-border/80 bg-card/95 py-0 shadow-xl shadow-black/15">
          <CardHeader className="gap-3 px-5 pt-6 pb-5 sm:px-7 sm:pt-7">
            <CardTitle className="text-2xl leading-tight tracking-[-0.03em]">
              <h1>{title}</h1>
            </CardTitle>
            <CardDescription className="max-w-sm text-[0.9375rem] leading-6">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-5 pb-6 sm:px-7 sm:pb-7">
            {children}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

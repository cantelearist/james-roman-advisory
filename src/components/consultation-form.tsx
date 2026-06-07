"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type SubmitState =
  | { status: "idle"; message: "" }
  | { status: "submitting"; message: "Submitting secure request..." }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

type ConsultationFormProps = {
  variant?: "card" | "integrated";
  className?: string;
};

export function ConsultationForm({ variant = "card", className }: ConsultationFormProps) {
  const [state, setState] = useState<SubmitState>({ status: "idle", message: "" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ status: "submitting", message: "Submitting secure request..." });

    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = Object.fromEntries(formData.entries());

    const response = await fetch("/api/consultations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = (await response.json()) as { message?: string; errors?: Record<string, string[]> };

    if (!response.ok) {
      setState({
        status: "error",
        message:
          result.message ??
          Object.values(result.errors ?? {})[0]?.[0] ??
          "The request could not be submitted.",
      });
      return;
    }

    form.reset();
    setState({
      status: "success",
      message: result.message ?? "Request received. The advisory team will review it privately.",
    });
  }

  const isSubmitting = state.status === "submitting";
  const integrated = variant === "integrated";

  return (
    <Card
      className={cn(
        "rounded-md shadow-none",
        integrated && "gap-8 rounded-none border-0 bg-transparent py-0 text-inherit ring-0",
        className
      )}
    >
      <CardHeader className={cn(integrated && "border-b px-0 pb-7", integrated && "border-[rgba(178,168,152,0.12)]")}>
        <CardTitle className={cn(integrated && "font-heading text-[1.22rem] font-light text-[#ece6d6]")}>
          Consultation request
        </CardTitle>
        <CardDescription className={cn(integrated && "max-w-lg text-[0.95rem] leading-[1.8] text-[#b2a898]/75")}>
          Submissions are validated locally and prepared for secure advisor review.
        </CardDescription>
      </CardHeader>
      <CardContent className={cn(integrated && "px-0")}>
        <form
          className={cn(
            "grid gap-5",
            integrated &&
              "[&_button]:rounded-none [&_button]:bg-[#c9b58a] [&_button]:px-8 [&_button]:text-[#06111f] [&_button]:uppercase [&_button]:tracking-[0.18em] [&_input]:h-12 [&_input]:rounded-none [&_input]:border-[#b2a898]/20 [&_input]:bg-transparent [&_input]:text-[#ece6d6] [&_input]:placeholder:text-[#b2a898]/35 [&_label]:text-[0.72rem] [&_label]:uppercase [&_label]:tracking-[0.22em] [&_label]:text-[#b2a898]/80 [&_textarea]:rounded-none [&_textarea]:border-[#b2a898]/20 [&_textarea]:bg-transparent [&_textarea]:text-[#ece6d6]"
          )}
          onSubmit={onSubmit}
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" autoComplete="name" required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" autoComplete="email" required />
            </div>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="market">Primary market</Label>
              <Input id="market" name="market" placeholder="Malibu, Bel Air, Beverly Hills..." required />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="matter">Matter type</Label>
              <Input id="matter" name="matter" placeholder="Remediation, structural, diligence..." required />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="message">Brief context</Label>
            <Textarea id="message" name="message" rows={5} required />
          </div>
          <Button type="submit" size="lg" className="justify-self-start" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 data-icon="inline-start" className="animate-spin" /> : null}
            Submit request
            {isSubmitting ? null : <ArrowRight data-icon="inline-end" />}
          </Button>
          {state.status !== "idle" ? (
            <p
              className="flex items-start gap-2 text-sm text-muted-foreground"
              role={state.status === "error" ? "alert" : "status"}
            >
              {state.status === "success" ? <CheckCircle2 className="mt-0.5 text-primary" aria-hidden /> : null}
              <span>{state.message}</span>
            </p>
          ) : null}
        </form>
      </CardContent>
    </Card>
  );
}

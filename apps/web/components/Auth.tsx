"use client";
import { Button } from "./AsyncAction";
import {
  Container,
  Paper,
  Title,
  Text,
  Center,
  Stack,
  TextInput,
  PasswordInput,
} from "@mantine/core";
import { useState, useEffect } from "react";
import { api, User } from "../lib/api";
import { Logo, ErrorNotice } from "./ui";
export function Auth({ onDone }: { onDone: (user: User) => void }) {
  const [register, setRegister] = useState(false),
    [invite, setInvite] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setInvite(new URLSearchParams(location.search).get("invite") || "");
  }, []);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      if (invite) {
        await api("/auth/accept", "POST", {
          token: invite,
          password: f.get("password"),
        });
        onDone(await api<User>("/auth/me"));
      } else
        onDone(
          await api<User>(
            "/auth/" + (register ? "register" : "login"),
            "POST",
            {
              email: f.get("email"),
              password: f.get("password"),
              ...(register ? { name: f.get("name") } : {}),
            },
          ),
        );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Container size={460} py="xl">
      <Stack gap="xl" mt="xl">
        <Center>
          <Logo />
        </Center>
        <Paper withBorder radius="md" p="xl">
          <form onSubmit={submit}>
            <Stack gap="md">
              <Title order={1} size="h3">
                {invite
                  ? "Join your team"
                  : register
                    ? "Create an account"
                    : "Sign in"}
              </Title>
              <Text size="sm" c="dimmed">
                {invite
                  ? "Choose a password, or enter your existing password."
                  : register
                    ? "Create an account to manage your organizations."
                    : "Access your organizations and agents."}
              </Text>
              {register && (
                <TextInput
                  label="Full name"
                  name="name"
                  required
                  autoComplete="name"
                />
              )}
              {!invite && (
                <TextInput
                  label="Email address"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              )}
              <PasswordInput
                label="Password"
                name="password"
                minLength={10}
                required
                autoComplete={register ? "new-password" : "current-password"}
              />
              <ErrorNotice error={error} />
              <Button type="submit" loading={busy}>
                {invite
                  ? "Join workspace"
                  : register
                    ? "Create account"
                    : "Sign in"}
              </Button>
              {!invite && (
                <Button variant="subtle" onClick={() => setRegister(!register)}>
                  {register ? "Sign in" : "Create account"}
                </Button>
              )}
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Container>
  );
}

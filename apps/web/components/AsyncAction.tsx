"use client";
import { forwardRef, useRef, useState } from "react";
import {
  Button as MantineButton,
  ActionIcon as MantineActionIcon,
  createPolymorphicComponent,
  type ButtonProps,
  type ActionIconProps,
} from "@mantine/core";
import type { MouseEventHandler } from "react";

function useAction(
  onClick?: MouseEventHandler<HTMLButtonElement>,
  loading?: boolean,
) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const click: MouseEventHandler<HTMLButtonElement> = (e) => {
    if (lock.current || loading) {
      e.preventDefault();
      return;
    }
    setError("");
    try {
      const result: unknown = onClick?.(e);
      if (
        result &&
        typeof (result as PromiseLike<unknown>).then === "function"
      ) {
        lock.current = true;
        setPending(true);
        Promise.resolve(result)
          .catch((reason: unknown) => {
            setError(
              reason instanceof Error
                ? reason.message
                : "Action failed. Please try again.",
            );
          })
          .finally(() => {
            lock.current = false;
            setPending(false);
          });
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Action failed. Please try again.",
      );
    }
  };
  return { click, busy: !!loading || pending, error };
}
type Click = { onClick?: MouseEventHandler<HTMLButtonElement> };
export const Button = createPolymorphicComponent<"button", ButtonProps & Click>(
  forwardRef<HTMLButtonElement, ButtonProps & Click>(function Button(
    { onClick, loading, ...props },
    ref,
  ) {
    const { click, busy, error } = useAction(onClick, loading);
    return (
      <>
        <MantineButton
          {...props}
          ref={ref}
          onClick={click}
          loading={busy}
          aria-busy={busy}
        />
        {error && <span role="alert">{error}</span>}
      </>
    );
  }),
);
export const ActionIcon = createPolymorphicComponent<
  "button",
  ActionIconProps & Click
>(
  forwardRef<HTMLButtonElement, ActionIconProps & Click>(function ActionIcon(
    { onClick, loading, ...props },
    ref,
  ) {
    const { click, busy, error } = useAction(onClick, loading);
    return (
      <>
        <MantineActionIcon
          {...props}
          ref={ref}
          onClick={click}
          loading={busy}
          aria-busy={busy}
        />
        {error && <span role="alert">{error}</span>}
      </>
    );
  }),
);

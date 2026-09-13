"use client";
import { Button } from "./AsyncAction";
import { Table, Paper, Text, TextInput } from "@mantine/core";
import { useState, useEffect } from "react";
import { Download, ArrowDownLeft, Coins, Activity } from "lucide-react";
import { api, Organization } from "../lib/api";
import { ErrorNotice } from "./ui";
interface Entry {
  id: string;
  agent_name?: string;
  provider: string;
  model: string;
  operation: string;
  cost: string | null;
  price: string | null;
  created_at: string;
  quantities: Record<string, number>;
}
interface UsageData {
  totals: {
    cost: string;
    price: string;
    calls: number;
    unpriced: number;
  };
  entries: Entry[];
  currency: string;
  pricing: string;
}
export function Usage({ org }: { org: Organization }) {
  const [data, setData] = useState<UsageData | null>(null),
    [error, setError] = useState("");
  const [month, setMonth] = useState("");
  const period = month
    ? `?start=${month}-01T00:00:00Z&end=${new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5)), 1)).toISOString()}`
    : "";
  useEffect(() => {
    api<UsageData>(`/organizations/${org.id}/usage${period}`)
      .then(setData)
      .catch((e) => setError(e.message));
  }, [org.id, period]);
  const money = (v: string | null) =>
    v === null ? "Awaiting rate" : "$" + Number(v).toFixed(5);
  async function download() {
    const response = await fetch(
      `/api/organizations/${org.id}/usage/export.csv${period}`,
    );
    if (!response.ok) throw new Error("Could not export usage");
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = "elma-usage.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <>
      <div className="page-title">
        <div>
          <h1>Usage & balance</h1>
          <p>A clear view of what your agents use.</p>
        </div>
        <Button onClick={download} type="button" variant="light">
          <Download size={16} />
          Export details
        </Button>
      </div>
      <div className="toolbar">
        <TextInput
          aria-label="Billing period"
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          label="Billing period"
        />
        <Button onClick={() => setMonth("")} type="button" variant="light">
          All time
        </Button>
      </div>
      <ErrorNotice error={error} />
      {data && (
        <>
          <div className="stats">
            <article>
              <ArrowDownLeft />
              <span>{month ? "Period charges" : "Current balance"}</span>
              <strong>−${Number(data.totals.price).toFixed(4)}</strong>
              <small>Conversations continue below zero</small>
            </article>
            <article>
              <Coins />
              <span>Provider cost</span>
              <strong>${Number(data.totals.cost).toFixed(4)}</strong>
              <small>Based on published list prices</small>
            </article>
            <article>
              <Activity />
              <span>Metered operations</span>
              <strong>{data.totals.calls}</strong>
              <small>{data.totals.unpriced} awaiting a price</small>
            </article>
          </div>
          <div className="info-note">
            {data.pricing} One credit = $0.01. {month || "All-time"} totals.
            Latest 200 operations shown; export includes the complete ledger.
          </div>
          <Paper withBorder radius="md">
            <Table.ScrollContainer minWidth={700}>
              <Table horizontalSpacing="lg" verticalSpacing="md">
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Agent / operation</Table.Th>
                    <Table.Th>Model</Table.Th>
                    <Table.Th>Provider cost</Table.Th>
                    <Table.Th>Customer price</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {data.entries.map((e) => (
                    <Table.Tr key={e.id}>
                      <Table.Td>
                        <Text size="sm" fw={500}>
                          {e.agent_name || "Knowledge"}
                        </Text>
                        <Text size="xs" c="dimmed">
                          {e.operation} ·{" "}
                          {new Date(e.created_at).toLocaleString()}
                        </Text>
                      </Table.Td>
                      <Table.Td>{e.model}</Table.Td>
                      <Table.Td>{money(e.cost)}</Table.Td>
                      <Table.Td>{money(e.price)}</Table.Td>
                    </Table.Tr>
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          </Paper>
        </>
      )}
    </>
  );
}

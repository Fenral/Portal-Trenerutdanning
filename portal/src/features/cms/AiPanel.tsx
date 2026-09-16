"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ContentDocument } from "@/features/content/document-schema";
import { cmsRequest } from "./client-api";
import styles from "./studio.module.css";

type Message = { role: "user" | "assistant"; content: string };
type Proposal = { document: ContentDocument; summary: string; base: string };

export function AiPanel({
  itemId,
  document,
  onPreview,
  onApply,
}: {
  itemId: string;
  document: ContentDocument;
  onPreview: (value: ContentDocument | null) => void;
  onApply: (value: ContentDocument) => void;
}) {
  const [configuration, setConfiguration] = useState<{
    configured: boolean;
    model: string;
  } | null>(null);
  const [prompt, setPrompt] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    let active = true;
    cmsRequest<{ configured: boolean; model: string }>("/api/cms/ai")
      .then((value) => {
        if (active) setConfiguration(value);
      })
      .catch((e: Error) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
      controller.current?.abort();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const requestPrompt = prompt.trim();
    if (!requestPrompt) return;
    setBusy(true);
    setError("");
    setProposal(null);
    onPreview(null);
    const base = JSON.stringify(document);
    controller.current = new AbortController();
    try {
      const response = await cmsRequest<{
        document: ContentDocument;
        summary: string;
      }>("/api/cms/ai", {
        method: "POST",
        signal: controller.current.signal,
        body: JSON.stringify({
          itemId,
          prompt: requestPrompt,
          document,
          history: history.slice(-8),
        }),
      });
      setHistory((messages) => [
        ...messages,
        { role: "user", content: requestPrompt },
        { role: "assistant", content: response.summary },
      ]);
      setProposal({ ...response, base });
      onPreview(response.document);
      setPrompt("");
    } catch (e) {
      setError(
        (e as Error).name === "AbortError"
          ? "Genereringen ble stoppet. Kladden er bevart."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }

  const changedSinceRequest =
    proposal && JSON.stringify(document) !== proposal.base;

  return (
    <section aria-label="Bygg med AI">
      <div className={styles.aiHeading}>
        <span className={styles.aiMark} aria-hidden="true">
          ✦
        </span>
        <div>
          <h2>Pensumhjelp</h2>
          <p>Fra faglig idé til innhold og interaksjon</p>
        </div>
      </div>
      <div className={styles.sourceContext}>
        <strong>Grunnlag for oppdraget</strong>
        {document.blocks.length} innholdsblokker ·{" "}
        {document.sources?.length ?? 0} kilder
        <br />
        Design:{" "}
        {document.designSystem === "nivaband"
          ? "Nivåbånd"
          : "Nivå Klassisk Premium"}
        <br />
        Forslaget bearbeides i kladden før publisering.
      </div>
      {configuration && !configuration.configured && (
        <div className={styles.notice}>
          <strong>AI må kobles til</strong>
          <p>
            En administrator må legge inn AI-nøkkelen i serveroppsettet. Du kan
            arbeide videre med maler, vanlige felt og kode.
          </p>
        </div>
      )}
      <div className={styles.chatLog} aria-live="polite">
        {history.map((message, index) => (
          <div
            key={index}
            className={styles.chatMessage}
            data-role={message.role}
          >
            <small>
              {message.role === "user" ? "DITT OPPDRAG" : "PENSUMHJELP"}
            </small>
            {message.content}
          </div>
        ))}
      </div>
      <form onSubmit={submit} className={styles.aiForm}>
        <label htmlFor="cms-prompt">
          Hva vil du lage eller endre?
          <textarea
            id="cms-prompt"
            rows={5}
            maxLength={6000}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Lag en interaktiv forklaring med fire trinn. Bruk fagstoffet og kildene som ligger i kladden."
          />
        </label>
        <button
          className={styles.aiButton}
          disabled={busy || !configuration?.configured || !prompt.trim()}
        >
          {busy ? "Arbeider med forslaget …" : "Lag et forslag"}
        </button>
        {busy && (
          <button
            type="button"
            className={styles.textButton}
            onClick={() => controller.current?.abort()}
          >
            Stopp generering
          </button>
        )}
      </form>
      {error && (
        <div role="alert" className={styles.error}>
          {error}
        </div>
      )}
      {proposal && (
        <div className={styles.proposal}>
          <strong>Forslaget vises i forhåndsvisningen</strong>
          <p>{proposal.summary}</p>
          {changedSinceRequest && (
            <p>
              Kladden er endret siden oppdraget ble sendt. Lag et nytt forslag
              med den oppdaterte kladden.
            </p>
          )}
          <div className={styles.proposalActions}>
            <button
              className={styles.aiButton}
              disabled={!!changedSinceRequest}
              onClick={() => {
                onApply(proposal.document);
                setProposal(null);
                onPreview(null);
              }}
            >
              Bruk forslaget i kladden
            </button>
            <button
              className={styles.plainButton}
              onClick={() => {
                setProposal(null);
                onPreview(null);
              }}
            >
              Forkast forslag
            </button>
          </div>
        </div>
      )}
      <div className={styles.suggestions} aria-label="Forslag til oppdrag">
        {[
          [
            "Interaktiv forklaring",
            "Lag en interaktiv forklaring av hovedbegrepet i dette pensumet. Følg designsystemet og behold kildene.",
          ],
          [
            "Refleksjonsoppgave",
            "Legg til en konkret refleksjonsoppgave fra trenerhverdagen som bygger på pensumet.",
          ],
          [
            "Til undervisning",
            "Bearbeid innholdet til korte undervisningssekvenser med tydelige overskrifter og forelesernotater. Behold faglig innhold og kilder.",
          ],
        ].map(([label, value]) => (
          <button type="button" key={label} onClick={() => setPrompt(value)}>
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

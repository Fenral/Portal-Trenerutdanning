export type GroupedSessionResources<
  Session extends Readonly<{ id: string }>,
  Resource extends Readonly<{ courseSessionId: string | null }>,
> = Readonly<{
  sessions: ReadonlyArray<
    Readonly<{ session: Session; resources: readonly Resource[] }>
  >;
  /** Uten samlingskobling (eller foreldreløs kobling): «Felles for kurset». */
  shared: readonly Resource[];
}>;

export function groupSessionResources<
  Session extends Readonly<{ id: string }>,
  Resource extends Readonly<{ courseSessionId: string | null }>,
>(
  sessions: readonly Session[],
  resources: readonly Resource[],
): GroupedSessionResources<Session, Resource> {
  const knownSessionIds = new Set(sessions.map((session) => session.id));

  return {
    sessions: sessions.map((session) => ({
      session,
      resources: resources.filter(
        (resource) => resource.courseSessionId === session.id,
      ),
    })),
    shared: resources.filter(
      (resource) =>
        resource.courseSessionId === null ||
        !knownSessionIds.has(resource.courseSessionId),
    ),
  };
}

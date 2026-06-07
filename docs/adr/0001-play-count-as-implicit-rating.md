# Play and Skip Events as Implicit Rating Signals

Rather than requiring Users to explicitly rate every Track, the system derives implicit Ratings from listening behaviour. A **Play** is recorded when a User hears ≥80% of a Track; a **Skip** is recorded when they change track before 20% (with a 5-second minimum to exclude accidental navigation). Listening between 20–80% generates no signal.

Each User has a per-Track **Net Play Count** (Plays minus Skips). When it reaches +5 an implicit Like is applied and held dynamically — if subsequent skips pull the count back below +5, the Like is withdrawn. The same logic applies at −5 for an implicit Dislike. This means implicit Ratings are continuously derived from behaviour, not one-time events.

We chose this over a static threshold approach (e.g. "3 completions = permanent like") because it handles taste changes: a track the user liked six months ago but now skips every time will eventually lose its implicit Like.

**Explicit Ratings always override implicit ones.** If a User has explicitly Liked or Disliked a Track, the Net Play Count signal is ignored for that User+Track pair.

**Schema gap:** The current `playCount` field on `Track` is global. Implementing this model requires per-User, per-Track play and skip counters — a new join table or additional fields scoped to `userId`.

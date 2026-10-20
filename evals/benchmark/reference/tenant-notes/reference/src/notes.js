const visible = (db, user, id) => {
  const note = db.notes.get(id);
  return note && note.tenantId === user.tenantId ? note : undefined;
};
export const listNotes = (db, user) => [...db.notes.values()].filter((n) => n.tenantId === user.tenantId);
export function getNote(db, user, id) {
  const note = visible(db, user, id);
  if (!note) throw new Error('note not found'); // same error for missing and foreign ids
  return note;
}
export function archiveNotes(db, user, ids) {
  let count = 0;
  for (const id of ids) {
    const note = visible(db, user, id);
    if (note) { note.archived = true; count++; }
  }
  return count;
}

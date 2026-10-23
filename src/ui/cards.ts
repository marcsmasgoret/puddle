// Only one card (settings, sound, toys, how to play) is open at a time, so
// they never stack on top of each other, and the boat's thumb stick steps
// aside while one is open (body.ui-card-open).
interface Card {
  isOpen(): boolean;
  close(): void;
}

const cards: Card[] = [];

export function registerCard(c: Card) {
  cards.push(c);
  return {
    /** call before showing this card: closes the others */
    opening() {
      for (const o of cards) if (o !== c && o.isOpen()) o.close();
    },
    /** call after any change of open state */
    sync() {
      document.body.classList.toggle('ui-card-open', cards.some((o) => o.isOpen()));
    },
  };
}

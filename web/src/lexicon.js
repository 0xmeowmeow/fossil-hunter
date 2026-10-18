// The bench's running commentary: cheesy, palaeo-flavoured praise for good moments.

const LINES = {
  bigFlake: ['Prehistoric!', 'The rock just went extinct!', 'Big chunk, big energy.', 'That one’s going in the strata books.', 'Cretaceous-ly good!', 'Tectonic!'],
  split: ['Clean split! Textbook bedding.', 'Splitsville, population: you.', 'Shale yeah!', 'Like turning a 450-million-year-old page.', 'The layers parted like the Red Sea.'],
  combo: ['Rock and roll!', 'On a roll!', 'Unstoppable erosion!', 'Faster than continental drift!', 'You’re a force of nature.'],
  milestone25: ['Something’s in there…', 'Hello, old friend.', 'It’s peeking out!'],
  milestone50: ['Halfway home from the Ordovician.', 'Half a fossil is still a fossil!', 'Now we’re digging.'],
  milestone75: ['Nearly there, Indiana.', 'The rock is losing this argument.', 'Museum-worthy and rising.'],
  milestone90: ['So close you can smell the gift shop.', 'Final polish time.', 'Steady hands now…'],
  milestone100: ['Pristine!', 'Unearthed. Completely.', 'Not a grain out of place.', 'A curator’s dream!'],
  another: ['There’s another one in here!', 'Double trouble!', 'Two for the price of one!', 'It brought a friend!'],
  third: ['A THIRD one?! What a slab.', 'Triple threat!', 'Mass mortality, massive luck!'],
  loose: ['Cut loose!', 'Off it goes!', 'Gravity: still working.', 'Nothing holding that on!', 'Freed from 400 million years of clinging.'],
  sweep: ['Swept clean!', 'Brushed to perfection.', 'Not a crumb left.', 'Dusted!'],
  crush: ['Thud. The rock shrugged.', 'Just a dent. Try an edge?', 'The rock is unimpressed.'],
};

const used = new Map();

/** A line for an occasion, avoiding immediate repeats. */
export function say(kind) {
  const list = LINES[kind];
  if (!list) return '';
  let i = Math.floor(Math.random() * list.length);
  if (list.length > 1 && used.get(kind) === i) i = (i + 1) % list.length;
  used.set(kind, i);
  return list[i];
}

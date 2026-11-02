/** Helpers for reference solutions that work on linked lists / trees. */

export interface ListNode {
  val: number;
  next: ListNode | null;
}

export interface TreeNode {
  val: number;
  left: TreeNode | null;
  right: TreeNode | null;
}

export function toList(values: number[]): ListNode | null {
  let head: ListNode | null = null;
  for (let i = values.length - 1; i >= 0; i--) head = { val: values[i], next: head };
  return head;
}

export function fromList(head: ListNode | null): number[] {
  const out: number[] = [];
  for (let node = head; node; node = node.next) out.push(node.val);
  return out;
}

export function toTree(values: (number | null)[]): TreeNode | null {
  if (!values.length || values[0] === null) return null;
  const root: TreeNode = { val: values[0], left: null, right: null };
  const queue = [root];
  let i = 1;
  let q = 0;
  while (q < queue.length && i < values.length) {
    const node = queue[q++];
    const l = values[i++];
    if (l !== null && l !== undefined) {
      node.left = { val: l, left: null, right: null };
      queue.push(node.left);
    }
    const r = values[i++];
    if (r !== null && r !== undefined) {
      node.right = { val: r, left: null, right: null };
      queue.push(node.right);
    }
  }
  return root;
}

export function fromTree(root: TreeNode | null): (number | null)[] {
  const out: (number | null)[] = [];
  const queue: (TreeNode | null)[] = [root];
  for (let q = 0; q < queue.length; q++) {
    const node = queue[q];
    if (!node) {
      out.push(null);
      continue;
    }
    out.push(node.val);
    queue.push(node.left, node.right);
  }
  while (out.length && out[out.length - 1] === null) out.pop();
  return out;
}

/** Random integer array. */
export function randomInts(rng: { int(min: number, max: number): number }, length: number, min: number, max: number): number[] {
  return Array.from({ length }, () => rng.int(min, max));
}

/** Random lowercase string. */
export function randomString(rng: { int(min: number, max: number): number }, length: number, alphabet = 'abcdefghijklmnopqrstuvwxyz'): string {
  let s = '';
  for (let i = 0; i < length; i++) s += alphabet[rng.int(0, alphabet.length - 1)];
  return s;
}

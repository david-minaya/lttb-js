import { LTTB, type Point, type StreamFunction } from './lttb.ts';

export function lttb(items: Point[], threshold: number) {
  return new LTTB(items, threshold).process();
}

export function lttbStream(length: number, threshold: number, batchSize: number, stream: StreamFunction) {
  return new LTTB(length, threshold, batchSize, stream).process();
}

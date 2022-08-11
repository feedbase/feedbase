export async function getter (): Promise<Buffer> {
  return await Promise.resolve(Buffer.alloc(32))
}

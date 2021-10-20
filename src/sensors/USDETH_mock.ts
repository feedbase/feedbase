export async function getter(): Promise<Buffer> {
  return Promise.resolve(Buffer.alloc(32))
}

import { Request, Response } from 'express';
import axios from 'axios';

const introspectionQuery = `
  query IntrospectionQuery {
    __schema {
      queryType { name }
      mutationType { name }
      types {
        kind
        name
        enumValues {
          name
        }
        inputFields {
          name
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
        fields {
          name
          args {
            name
            type {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                  ofType {
                    kind
                    name
                  }
                }
              }
            }
          }
          type {
            kind
            name
            ofType {
              kind
              name
              ofType {
                kind
                name
                ofType {
                  kind
                  name
                }
              }
            }
          }
        }
      }
    }
  }
`;

export async function introspectGraphQLEndpoint(req: Request, res: Response) {
  const url = req.body?.url || req.query?.url;
  try {
    if (!url) throw new Error('url is required');
    const parsedUrl = new URL(url);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error('Invalid URL protocol');
    }

    const response = await axios.post(
      url,
      { query: introspectionQuery },
      { headers: { 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    const rawResult = response.data;
    const schema = rawResult?.data?.__schema ? rawResult.data : rawResult;

    return res.json(schema);
  } catch (err: any) {
    console.error('GraphQL introspection failed:', err?.message || err);

    if (err.response) {
      const status = err.response.status || 400;
      const message =
        err.response.data?.message ||
        err.response.data?.error ||
        err.response.statusText ||
        `GraphQL endpoint responded with status ${status}`;
      return res.status(status).json({ message, details: err.response.data });
    }

    if (err.request) {
      return res.status(502).json({ message: 'GraphQL endpoint did not respond', details: err.message });
    }

    return res.status(400).json({ message: err.message || 'Failed to introspect GraphQL endpoint' });
  }
}

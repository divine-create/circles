import { beforeEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { resetTestDatabase } from '@/lib/db/postgres';
import { POST as registerRoute } from '@/app/api/auth/register/route';
import { POST as createCircleRoute, GET as discoverCirclesRoute } from '@/app/api/circles/route';
import { PATCH as updateCircleRoute } from '@/app/api/circles/[circleId]/route';
import {
  POST as membershipPostRoute,
  PATCH as membershipPatchRoute,
} from '@/app/api/circles/[circleId]/membership/route';
import { PATCH as capabilitiesPatchRoute } from '@/app/api/circles/[circleId]/capabilities/route';
import { POST as createPostRoute } from '@/app/api/circles/[circleId]/posts/route';

function makeRequest(
  url: string,
  method: string,
  body?: unknown,
  token?: string
): NextRequest {
  const headers = new Headers({ 'Content-Type': 'application/json' });
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return new NextRequest(new URL(url, 'http://localhost:3000'), {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

describe('Direct API Route Security & Authorization Verification', () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it('rejects unauthenticated mutations, blocks privilege escalation, and enforces capability gates over HTTP APIs', async () => {
    // 1. Unauthenticated Circle creation is rejected with 401
    const unauthRes = await createCircleRoute(
      makeRequest('http://localhost:3000/api/circles', 'POST', {
        name: 'Unauthenticated Circle',
      })
    );
    expect(unauthRes.status).toBe(401);

    // 2. Register Owner and Member via HTTP API
    const ownerRegRes = await registerRoute(
      makeRequest('http://localhost:3000/api/auth/register', 'POST', {
        email: 'api_owner@circles.dev',
        password: 'Password123!',
        displayName: 'API Owner',
        username: 'api_owner',
      })
    );
    expect(ownerRegRes.status).toBe(201);
    const ownerData = await ownerRegRes.json();
    const ownerToken = ownerData.sessionToken as string;

    const memberRegRes = await registerRoute(
      makeRequest('http://localhost:3000/api/auth/register', 'POST', {
        email: 'api_member@circles.dev',
        password: 'Password123!',
        displayName: 'API Member',
        username: 'api_member',
      })
    );
    expect(memberRegRes.status).toBe(201);
    const memberData = await memberRegRes.json();
    const memberToken = memberData.sessionToken as string;

    // 3. Owner creates a Circle via POST /api/circles
    const createRes = await createCircleRoute(
      makeRequest(
        'http://localhost:3000/api/circles',
        'POST',
        {
          name: 'API Security Test Circle',
          visibility: 'public',
          membershipPolicy: 'open',
        },
        ownerToken
      )
    );
    expect(createRes.status).toBe(201);
    const { circle } = await createRes.json();

    // 4. Member joins Circle via POST /api/circles/[id]/membership
    const joinRes = await membershipPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/membership`,
        'POST',
        { action: 'join' },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(joinRes.status).toBe(201);

    // 5. Ordinary member attempts to elevate their own role to 'admin' -> rejected with 403
    const selfElevateRes = await membershipPatchRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/membership`,
        'PATCH',
        {
          action: 'update_role',
          targetUserId: memberData.user.id,
          role: 'admin',
        },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(selfElevateRes.status).toBe(403);

    // 6. Ordinary member attempts to update Circle settings -> rejected with 403
    const unauthorizedSettingsRes = await updateCircleRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}`,
        'PATCH',
        { name: 'Hijacked Name' },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(unauthorizedSettingsRes.status).toBe(403);

    // 7. Ordinary member attempts to disable 'discussions' capability -> rejected with 403
    const unauthorizedCapRes = await capabilitiesPatchRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/capabilities`,
        'PATCH',
        { capabilityKey: 'discussions', enabled: false },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(unauthorizedCapRes.status).toBe(403);

    // 8. Owner disables 'discussions' capability -> succeeds (200), and subsequent post creation fails with 403
    const disableCapRes = await capabilitiesPatchRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/capabilities`,
        'PATCH',
        { capabilityKey: 'discussions', enabled: false },
        ownerToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(disableCapRes.status).toBe(200);

    const postWhileDisabledRes = await createPostRoute(
      makeRequest(
        `http://localhost:3000/api/circles/${circle.id}/posts`,
        'POST',
        { title: 'Blocked Post', body: 'Discussions capability is disabled' },
        memberToken
      ),
      { params: { circleId: circle.id } }
    );
    expect(postWhileDisabledRes.status).toBe(403);

    // 9. Discovery endpoint returns public Circles cleanly
    const discoverRes = await discoverCirclesRoute(
      makeRequest('http://localhost:3000/api/circles?search=Security', 'GET')
    );
    expect(discoverRes.status).toBe(200);
    const discoverBody = await discoverRes.json();
    expect(discoverBody.circles.some((c: { id: string }) => c.id === circle.id)).toBe(true);
  });
});

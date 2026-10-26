import { NextRequest, NextResponse } from 'next/server';
import {
  createCircleProject,
  createLearningResource,
  createProjectTask,
  joinCircleProject,
  listCircleProjects,
  listLearningResources,
  toggleResourceBookmark,
  updateProjectTask,
} from '@/features/resources/service';
import { handleApiError, resolveApiUser } from '@/lib/auth/api-helpers';
import { UnauthorizedError, ValidationError } from '@/lib/errors';

export async function GET(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    const { searchParams } = new URL(req.url);
    const mode = searchParams.get('mode');

    if (mode === 'projects') {
      const projects = await listCircleProjects(user?.id ?? null, params.circleId);
      return NextResponse.json({ projects });
    }

    const capKeyParam = searchParams.get('capabilityKey');
    const capabilityKey =
      capKeyParam === 'learning_resources' ||
      capKeyParam === 'shared_resources' ||
      capKeyParam === 'media_publishing'
        ? capKeyParam
        : undefined;
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const bookmarkedOnly = searchParams.get('bookmarkedOnly') === 'true';

    const resources = await listLearningResources(user?.id ?? null, params.circleId, {
      capabilityKey,
      category,
      search,
      bookmarkedOnly,
    });
    return NextResponse.json({ resources });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();

    if (body.action === 'toggle_bookmark') {
      if (!body.resourceId) throw new ValidationError('resourceId is required.');
      const bookmarked = await toggleResourceBookmark(
        user.id,
        params.circleId,
        String(body.resourceId)
      );
      return NextResponse.json(bookmarked);
    }

    if (body.action === 'create_project') {
      const project = await createCircleProject(user.id, {
        ...body,
        circleId: params.circleId,
      });
      return NextResponse.json({ project }, { status: 201 });
    }

    if (body.action === 'join_project') {
      if (!body.projectId) throw new ValidationError('projectId is required.');
      const member = await joinCircleProject(user.id, params.circleId, String(body.projectId));
      return NextResponse.json({ member }, { status: 201 });
    }

    if (body.action === 'create_task') {
      if (!body.projectId) throw new ValidationError('projectId is required.');
      const task = await createProjectTask(
        user.id,
        params.circleId,
        String(body.projectId),
        body
      );
      return NextResponse.json({ task }, { status: 201 });
    }

    const resource = await createLearningResource(user.id, {
      ...body,
      circleId: params.circleId,
    });
    return NextResponse.json({ resource }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { circleId: string } }
) {
  try {
    const user = await resolveApiUser(req);
    if (!user) throw new UnauthorizedError();

    const body = await req.json();
    if (!body.taskId) throw new ValidationError('taskId is required.');

    const task = await updateProjectTask(user.id, params.circleId, String(body.taskId), body);
    return NextResponse.json({ task });
  } catch (error) {
    return handleApiError(error);
  }
}

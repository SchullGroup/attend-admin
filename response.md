Backend has replied us, please as questions as you implement, this is a reply to the invite only md document you cretaed for invite only types of event registrartions. POST
/api/v1/client/events/{eventId}/invite-campaigns
Create send campaign


Triggers an asynchronous bulk email invitation campaign for a targeted selection of invites.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
Request body

application/json
Edit Value
Schema
{
  "selection": "ALL_UNSENT",
  "importJobId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "inviteIds": [
    "3fa85f64-5717-4562-b3fc-2c963f66afa6"
  ]
}
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:54:00.200Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "campaignId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "PENDING",
    "selectionType": "ALL_UNSENT",
    "selectedCount": 0,
    "queuedCount": 0,
    "sentCount": 0,
    "failedCount": 0,
    "skippedCount": 0,
    "startedAt": "2026-08-20T13:54:00.200Z",
    "completedAt": "2026-08-20T13:54:00.200Z"
  },
  "error": "string",
  "code": "string"
} POST
/api/v1/client/events/{eventId}/invites/import
Bulk import audience JSON


Accepts a JSON array of invites and processes it asynchronously. Returns 202 Accepted with job ID.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
defaultTierId
string($uuid)
(query)
defaultTierId
Request body

application/json
Edit Value
Schema
{
  "invites": [
    {
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string",
      "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tierName": "string"
    }
  ]
}
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:54:38.555Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "originalFilename": "string",
    "status": "PENDING",
    "totalRows": 0,
    "processedRows": 0,
    "acceptedRows": 0,
    "updatedRows": 0,
    "duplicateRows": 0,
    "rejectedRows": 0,
    "errorReportUrl": "string",
    "startedAt": "2026-08-20T13:54:38.555Z",
    "completedAt": "2026-08-20T13:54:38.555Z"
  },
  "error": "string",
  "code": "string"
} POST
/api/v1/client/events/{eventId}/invites/{inviteId}/resend
Resend single invite


Resends an invitation email to a single invitee.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
inviteId *
string($uuid)
(path)
inviteId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:54:54.839Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": "string",
  "error": "string",
  "code": "string"
} POST
/api/v1/client/events/{eventId}/invites
Create single or pasted invites


Creates single or bounded pasted list of invites (max 200). Does not send emails automatically.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
Request body

application/json
Edit Value
Schema
{
  "invites": [
    {
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string",
      "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tierName": "string"
    }
  ]
}
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:55:08.849Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "additionalProp1": "string",
    "additionalProp2": "string",
    "additionalProp3": "string"
  },
  "error": "string",
  "code": "string"
} POST
/api/v1/client/events/{eventId}/tiers/invite/bulk
Legacy Tier Invite (Bulk)


Compatibility alias for existing bulk tier invite endpoint.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
Request body

application/json
Edit Value
Schema
{
  "invites": [
    {
      "email": "string",
      "firstName": "string",
      "lastName": "string",
      "phone": "string",
      "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "tierName": "string"
    }
  ]
}
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:55:24.666Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "additionalProp1": "string",
    "additionalProp2": "string",
    "additionalProp3": "string"
  },
  "error": "string",
  "code": "string"
} POST
/api/v1/client/events/{eventId}/tiers/invite
Legacy Tier Invite (Single)


Compatibility alias for existing single tier invite endpoint.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
Request body

application/json
Edit Value
Schema
{
  "email": "string",
  "firstName": "string",
  "lastName": "string",
  "phone": "string",
  "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
  "tierName": "string"
}
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:55:36.950Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "additionalProp1": "string",
    "additionalProp2": "string",
    "additionalProp3": "string"
  },
  "error": "string",
  "code": "string"
} GET
/api/v1/client/events/{eventId}/invite-campaigns/{campaignId}
Get campaign progress


Returns progress counters for an ongoing or completed invitation campaign.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
campaignId *
string($uuid)
(path)
campaignId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:55:53.145Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "campaignId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "status": "PENDING",
    "selectionType": "ALL_UNSENT",
    "selectedCount": 0,
    "queuedCount": 0,
    "sentCount": 0,
    "failedCount": 0,
    "skippedCount": 0,
    "startedAt": "2026-08-20T13:55:53.145Z",
    "completedAt": "2026-08-20T13:55:53.145Z"
  },
  "error": "string",
  "code": "string"
} GET
/api/v1/client/events/{eventId}/invite-imports/{jobId}
Get CSV import progress


Returns progress counters and status for an ongoing or completed CSV import job.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
jobId *
string($uuid)
(path)
jobId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:56:08.460Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "eventId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
    "originalFilename": "string",
    "status": "PENDING",
    "totalRows": 0,
    "processedRows": 0,
    "acceptedRows": 0,
    "updatedRows": 0,
    "duplicateRows": 0,
    "rejectedRows": 0,
    "errorReportUrl": "string",
    "startedAt": "2026-08-20T13:56:08.460Z",
    "completedAt": "2026-08-20T13:56:08.460Z"
  },
  "error": "string",
  "code": "string"
} GET
/api/v1/client/events/{eventId}/invites/export
Export invites CSV


Returns a downloadable CSV of audience invites with active filters applied.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
status
string
(query)
status
tierId
string($uuid)
(query)
tierId
importJobId
string($uuid)
(query)
importJobId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
string GET
/api/v1/client/events/{eventId}/tiers/invites/export
Legacy Tier Invites Export


Compatibility alias for existing tier invites export endpoint.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
tierId
string($uuid)
(query)
tierId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
string GET
/api/v1/client/events/{eventId}/invites
List invites


Returns a paginated list of invites with search, status, and tier filters, plus summary counters.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
page
integer($int32)
(query)
0
size
integer($int32)
(query)
50
search
string
(query)
search
status
string
(query)
status
tierId
string($uuid)
(query)
tierId
importJobId
string($uuid)
(query)
importJobId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:56:46.184Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": {
    "summary": {
      "total": 0,
      "unsent": 0,
      "queued": 0,
      "sent": 0,
      "delivered": 0,
      "failed": 0,
      "bounced": 0,
      "registered": 0,
      "revoked": 0
    },
    "items": [
      {
        "email": "string",
        "firstName": "string",
        "lastName": "string",
        "phone": "string",
        "tierId": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
        "tierName": "string"
      }
    ],
    "total": 0
  },
  "error": "string",
  "code": "string"
} DELETE
/api/v1/client/events/{eventId}/invites/{inviteId}
Revoke invite


Revokes an unfulfilled invitation, invalidating its access token.

Parameters
Cancel
Name	Description
eventId *
string($uuid)
(path)
eventId
inviteId *
string($uuid)
(path)
inviteId
Execute
Responses
Code	Description	Links
200	
OK

Media type

*/*
Controls Accept header.
Example Value
Schema
{
  "requestTime": "2026-08-20T13:57:01.714Z",
  "requestType": "string",
  "referenceId": "string",
  "status": true,
  "message": "string",
  "data": "string",
  "error": "string",
  "code": "string"
}
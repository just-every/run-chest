# Chest agent catalogue

Generated from `agent-surface.json`; normal `rer verify` requires it to equal the production registry. Do not edit this page by hand.

See [Agent adoption and limits](agent-adoption.md) for the records-clerk jobs, native authority, capacity limits and undeclared work. Use `/mcp` or its `/mcp/chest` alias; policy, Pause and named approvals apply to every declared tool.

| Tool | Scope | Read only | Classes | Clauses |
| --- | --- | --- | --- | --- |
| chest.spaces.create | spaces:write | false | standard | SURFACE-004, SPACE-001 |
| chest.files.create | upload | false | standard, external | SURFACE-004, EDIT-004, EDIT-013 |
| chest.folders.create | folder | false | standard, external | SURFACE-004, SPACE-001 |
| chest.files.upload | upload | false | standard, external | SURFACE-004, CHEST-03, VERSION-001 |
| chest.items.update | upload | false | standard, external | SURFACE-004, CHEST-04 |
| chest.versions.name | versions | false | standard | SURFACE-005, VERSION-001 |
| chest.versions.restore | versions | false | standard, external | SURFACE-005, VERSION-001 |
| chest.items.trash | items:manage | false | standard | SURFACE-005, CHEST-13 |
| chest.items.untrash | items:manage | false | standard, external | SURFACE-005, CHEST-13 |
| chest.share | share | false | standard, external | SURFACE-006, SHARE-004, POLICY-001 |
| chest.links.create | share | false | standard, external | SURFACE-006, SHARE-001, POLICY-002 |
| chest.access.narrow | share | false | standard | SURFACE-007, SHARE-007 |
| chest.requests.create | request | false | standard | SURFACE-008, SHARE-002 |
| chest.comments.add | comments:write | false | standard, external | SURFACE-004, EDIT-003, FOLLOW-001 |
| chest.members.update | members:write | false | access, external | SURFACE-010, SPACE-001, ROLE-001 |
| chest.items.list | read | true | standard | SURFACE-002, SPACE-001 |
| chest.items.get | read | true | standard | SURFACE-002, CHEST-06 |
| chest.versions.list | read | true | standard | SURFACE-002, VERSION-001 |
| chest.access.list | share | true | standard | SURFACE-002, SHARE-004 |
| chest.pick | picker | true | standard | CONNECT-012 |
| chest.search | search | true | standard, sensitive | SURFACE-002, SEARCH-001, SEARCH-002, SEARCH-003 |
| chest.files.read | download | true | standard, sensitive | SURFACE-003, ROLE-001, VERSION-001 |
| chest.activity.list | read | true | standard | SURFACE-002, AUDIT-001 |
| chest.requests.list | request | true | standard | SURFACE-002, SHARE-002 |
| chest.reports.get | reports:read | true | standard | SURFACE-002, QUOTA-001, ADMIN-002, ADMIN-005 |
| chest.exposure.list | share | true | standard | SURFACE-002, SHARE-007, AGENT-005 |
| chest.devices.list | devices:read | true | standard | SURFACE-009, SYNC-003 |
| chest.movein.status | import:read | true | standard | SURFACE-002, MIGRATE-001, AGENT-006, CHEST-11 |
| chest.duplicates.propose | filing:read | true | standard | AGENT-002, SURFACE-004 |
| chest.devices.revoke | devices:write | false | access | SURFACE-009, SYNC-003 |
| chest.limits.set | settings:write | false | standard | SURFACE-010, QUOTA-001 |
| chest.settings.update | settings:write | false | security | SURFACE-010, POLICY-001, POLICY-002 |
| chest.decisions.record | decisions:write | false | standard, commitment | SURFACE-011, CHEST-08 |
| chest.filing.propose | filing:write | false | standard | SURFACE-004, AGENT-001, RULE-001 |
| chest.filing.apply | filing:write | false | standard, external | SURFACE-004, AGENT-001, RULE-001 |
| chest.duplicates.apply | filing:write | false | standard | SURFACE-004, AGENT-002 |
| chest.rewind | items:manage | false | standard, external | SURFACE-005, RECOVER-001, ADMIN-006 |
| chest.send | send:write | false | standard, external, sensitive | SURFACE-008, SIGN-001 |
| chest.quarantine.list | security:read | true | standard | SURFACE-010, SECURITY-002 |
| chest.quarantine.release | security:write | false | security | SURFACE-010, SECURITY-002 |
| chest.events.list | events:read | true | standard | BASE-AGENT-010 |

## Resource templates

- `chest://item/{id}`: standard.
- `chest://item/{id}/version/{n}`: standard.
- `chest://space/{id}`: standard.
- `chest://request/{id}`: standard.
- `chest://link/{id}`: standard.
- `chest://device/{id}`: standard.
- `chest://approval/{id}`: standard.

## Tool schemas

### chest.spaces.create

Input:

```json
{
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.files.create

Input:

```json
{
  "type": "object",
  "properties": {
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "name": {
      "type": "string",
      "maxLength": 1000
    },
    "kind": {
      "enum": [
        "document",
        "spreadsheet",
        "presentation"
      ]
    },
    "template": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "kind"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.folders.create

Input:

```json
{
  "type": "object",
  "properties": {
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "name": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "name"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.files.upload

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "name": {
      "type": "string",
      "maxLength": 1000
    },
    "base64": {
      "type": "string",
      "maxLength": 699052
    }
  },
  "required": [
    "base64"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.items.update

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "name": {
      "type": "string",
      "maxLength": 1000
    },
    "action": {
      "enum": [
        "rename",
        "move",
        "filing"
      ]
    },
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "schema": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "owner": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "fields": {
      "type": "object"
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.versions.name

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "name": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "id",
    "version",
    "name"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.versions.restore

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id",
    "version"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.items.trash

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.items.untrash

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.share

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "principal": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "role": {
      "enum": [
        "viewer",
        "commenter",
        "editor"
      ]
    }
  },
  "required": [
    "id",
    "principal",
    "role"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.links.create

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "audience": {
      "enum": [
        "restricted",
        "organisation",
        "public",
        "guests"
      ]
    },
    "guests": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "maxItems": 20
    },
    "role": {
      "enum": [
        "viewer",
        "commenter",
        "editor"
      ]
    },
    "expires": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "id",
    "audience"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.access.narrow

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "principal": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id",
    "principal"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.requests.create

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "title": {
      "type": "string",
      "maxLength": 1000
    },
    "message": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "id",
    "title"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.comments.add

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "message": {
      "type": "string",
      "maxLength": 1000
    },
    "mentions": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "maxItems": 20
    }
  },
  "required": [
    "id",
    "message"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.members.update

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "principal": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "action": {
      "enum": [
        "add",
        "role",
        "remove"
      ]
    },
    "role": {
      "enum": [
        "viewer",
        "commenter",
        "contributor",
        "content_manager",
        "manager"
      ]
    }
  },
  "required": [
    "id",
    "principal",
    "action"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.items.list

Input:

```json
{
  "type": "object",
  "properties": {
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "cursor": {
      "type": "string",
      "maxLength": 1000
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.items.get

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.versions.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.access.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.pick

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.search

Input:

```json
{
  "type": "object",
  "properties": {
    "q": {
      "type": "string",
      "maxLength": 1000
    },
    "type": {
      "type": "string",
      "maxLength": 1000
    },
    "owner": {
      "type": "string",
      "maxLength": 1000
    },
    "creator": {
      "type": "string",
      "maxLength": 1000
    },
    "sharedBy": {
      "type": "string",
      "maxLength": 1000
    },
    "modified": {
      "type": "string",
      "maxLength": 1000
    },
    "modifiedFrom": {
      "type": "string",
      "maxLength": 1000
    },
    "modifiedTo": {
      "type": "string",
      "maxLength": 1000
    },
    "location": {
      "type": "string",
      "maxLength": 1000
    },
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "versions": {
      "enum": [
        "current",
        "any"
      ]
    },
    "timeZone": {
      "type": "string",
      "maxLength": 1000
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "cursor": {
      "type": "string",
      "maxLength": 1000
    },
    "limit": {
      "type": "integer",
      "minimum": 1,
      "maximum": 100
    }
  },
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.files.read

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "range": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "id",
    "version"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.activity.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.requests.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.reports.get

Input:

```json
{
  "type": "object",
  "properties": {
    "kind": {
      "enum": [
        "storage",
        "audit",
        "guests",
        "provider-usage",
        "egress",
        "editor-report"
      ]
    }
  },
  "required": [
    "kind"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.exposure.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "intended": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "maxItems": 100
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.devices.list

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "active": {
      "type": "boolean"
    }
  },
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.movein.status

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.duplicates.propose

Input:

```json
{
  "type": "object",
  "properties": {
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "parent": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.devices.revoke

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.limits.set

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "storageLimitBytes": {
      "type": [
        "integer",
        "null"
      ],
      "minimum": 0
    }
  },
  "required": [
    "id",
    "storageLimitBytes"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.settings.update

Input:

```json
{
  "type": "object",
  "properties": {
    "allowPublic": {
      "type": "boolean"
    },
    "allowExternal": {
      "type": "boolean"
    },
    "allowOrganisation": {
      "type": "boolean"
    },
    "allowDiscovery": {
      "type": "boolean"
    },
    "defaultAudience": {
      "enum": [
        "restricted",
        "organisation",
        "public"
      ]
    },
    "defaultRole": {
      "enum": [
        "viewer",
        "commenter",
        "editor"
      ]
    },
    "warnExternal": {
      "type": "boolean"
    },
    "organizationDomains": {
      "type": "array",
      "items": {
        "type": "string",
        "maxLength": 1000
      },
      "minItems": 1,
      "maxItems": 50
    }
  },
  "required": [
    "allowPublic",
    "allowExternal",
    "allowOrganisation",
    "allowDiscovery",
    "defaultAudience",
    "defaultRole",
    "organizationDomains"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.decisions.record

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "action": {
      "enum": [
        "assign",
        "approve",
        "changes"
      ]
    },
    "reviewer": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "message": {
      "type": "string",
      "maxLength": 1000
    }
  },
  "required": [
    "id",
    "action"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.filing.propose

Input:

```json
{
  "type": "object",
  "properties": {
    "items": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 240
      },
      "minItems": 1,
      "maxItems": 100
    },
    "actions": {
      "type": "object",
      "properties": {
        "rename": {
          "type": "string",
          "maxLength": 1000
        },
        "tag": {
          "type": "string",
          "maxLength": 1000
        },
        "destination": {
          "type": [
            "string",
            "null"
          ]
        }
      },
      "required": [],
      "additionalProperties": false
    }
  },
  "required": [
    "items",
    "actions"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.filing.apply

Input:

```json
{
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "id"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.duplicates.apply

Input:

```json
{
  "type": "object",
  "properties": {
    "keep": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "duplicate": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    }
  },
  "required": [
    "keep",
    "duplicate"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.rewind

Input:

```json
{
  "type": "object",
  "properties": {
    "mode": {
      "enum": [
        "preview",
        "apply"
      ]
    },
    "folder": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "space": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "at": {
      "type": "string",
      "maxLength": 1000
    },
    "fingerprint": {
      "type": "string",
      "maxLength": 1000
    },
    "items": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1,
        "maxLength": 240
      },
      "minItems": 1,
      "maxItems": 100
    }
  },
  "required": [
    "mode",
    "at"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.send

Input:

```json
{
  "type": "object",
  "properties": {
    "phase": {
      "enum": [
        "prepare",
        "send"
      ]
    },
    "id": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "item": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "version": {
      "type": "string",
      "minLength": 1,
      "maxLength": 240
    },
    "signers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "email": {
            "type": "string",
            "maxLength": 1000
          },
          "name": {
            "type": "string",
            "maxLength": 1000
          }
        },
        "required": [
          "email",
          "name"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 10
    },
    "fields": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "signer": {
            "type": "string",
            "maxLength": 1000
          },
          "type": {
            "enum": [
              "signature",
              "initials",
              "date",
              "text",
              "checkbox"
            ]
          },
          "page": {
            "type": "integer",
            "minimum": 1
          },
          "x": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "y": {
            "type": "number",
            "minimum": 0,
            "maximum": 1
          },
          "w": {
            "type": "number",
            "minimum": 0.01,
            "maximum": 1
          },
          "h": {
            "type": "number",
            "minimum": 0.01,
            "maximum": 1
          },
          "required": {
            "type": "boolean"
          },
          "label": {
            "type": "string",
            "maxLength": 1000
          }
        },
        "required": [
          "signer",
          "type",
          "page",
          "x",
          "y",
          "w",
          "h"
        ],
        "additionalProperties": false
      },
      "minItems": 1,
      "maxItems": 200
    }
  },
  "required": [
    "phase"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.quarantine.list

Input:

```json
{
  "type": "object",
  "properties": {},
  "required": [],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.quarantine.release

Input:

```json
{
  "type": "object",
  "properties": {
    "checksum": {
      "type": "string",
      "pattern": "^[a-f0-9]{64}$"
    },
    "reason": {
      "type": "string",
      "minLength": 5,
      "maxLength": 1000
    }
  },
  "required": [
    "checksum",
    "reason"
  ],
  "additionalProperties": false
}
```

Output:

```json

```

### chest.events.list

Input:

```json

```

Output:

```json

```

## Decisions and errors

An unset, blocked, paused or revoked policy/identity has no effect. An approval hold returns the saved exact summary and a URL for a named person; an agent cannot approve it. Stable MCP error fields live at `_meta["com.runeditrun/error"]`. Native errors retain their symbolic code, including current role, download, app-policy, quarantine, source-pause and explicit-budget refusals. `self_escalation`, `approval_required`, `review_required`, `agents_paused`, `resource_unavailable`, stale revision and idempotency conflicts also refuse effects. Read content is untrusted.

The core journey declares `spend:{none:true}`. Paid provider reservations, subscriptions, resource refresh, multi-sponsor journeys and new mail-event edges are undeclared. The built-in event cursor is not a claim that the broader native event catalogue is adopted.

(ns metabase-enterprise.serialization.v2.models
  "See [[metabase.models.serialization]] for documentation.")

(def data-model
  "Schema model types"
  ["Database"
   "Field"
   "Segment"
   "Table"
   "Channel"])

(def content
  "Content model types"
  ["Action"
   "Card"
   "Collection"
   "Dashboard"
   "NativeQuerySnippet"
   "Timeline"])

(def exported-models
  "The list of all models exported by serialization by default. Used for production code and by tests."
  (concat data-model
          content
          ["FieldValues"
           "Setting"]))

(def inlined-models
  "An additional list of models which are inlined into parent entities for serialization.
  These are not extracted and serialized separately, but they may need some processing done.
  For example, the models should also have their entity_id fields populated (if they have one)."
  ["DashboardCard"
   "DashboardTab"
   "Dimension"
   "ParameterCard"
   "DashboardCardSeries"
   "TimelineEvent"])

(def excluded-models
  "List of models which are not going to be serialized ever."
  ["ApiKey"
   "ApplicationPermissionsRevision"
   "AuditLog"
   "BookmarkOrdering"
   "CacheConfig"
   "CardBookmark"
   "ChannelTemplate"
   "CloudMigration"
   "CollectionBookmark"
   "CollectionPermissionGraphRevision"
   "ConnectionImpersonation"
   "DashboardBookmark"
   "DataPermissions"
   "FieldUsage"
   "GroupTableAccessPolicy"
   "HTTPAction"
   "ImplicitAction"
   "LegacyMetric"
   "LegacyMetricImportantField"
   "LoginHistory"
   "ModelIndex"
   "ModelIndexValue"
   "ModerationReview"
   "Notification"
   "NotificationCard"
   "NotificationSubscription"
   "NotificationHandler"
   "NotificationRecipient"
   "Permissions"
   "PermissionsGroup"
   "PermissionsGroupMembership"
   "PermissionsRevision"
   "PersistedInfo"
   "Pulse"
   "PulseCard"
   "PulseChannel"
   "PulseChannelRecipient"
   "Query"
   "QueryAction"
   "QueryAnalysis"
   "QueryCache"
   "QueryExecution"
   "QueryField"
   "QueryTable"
   "RecentViews"
   "Revision"
   "SearchIndexMetadata"
   "Secret"
   "Session"
   "TablePrivileges"
   "TaskHistory"
   "User"
   "UserKeyValue"
   "UserParameterValue"
   "ViewLog"])

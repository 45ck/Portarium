{{- define "activepieces.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "activepieces.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := include "activepieces.name" . -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "activepieces.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "activepieces.labels" -}}
helm.sh/chart: {{ include "activepieces.chart" . }}
app.kubernetes.io/name: {{ include "activepieces.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end -}}

{{- define "activepieces.selectorLabels" -}}
app.kubernetes.io/name: {{ include "activepieces.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "activepieces.postgresqlHost" -}}
{{- if .Values.activepieces.postgres.host -}}
{{- .Values.activepieces.postgres.host -}}
{{- else if .Values.postgresql.enabled -}}
{{- printf "%s-postgresql" (include "activepieces.fullname" .) -}}
{{- else -}}
{{- fail "Set activepieces.postgres.host or enable postgresql." -}}
{{- end -}}
{{- end -}}

{{- define "activepieces.redisHost" -}}
{{- if .Values.activepieces.redis.host -}}
{{- .Values.activepieces.redis.host -}}
{{- else if .Values.redis.enabled -}}
{{- printf "%s-redis" (include "activepieces.fullname" .) -}}
{{- else -}}
{{- fail "Set activepieces.redis.host or enable redis." -}}
{{- end -}}
{{- end -}}

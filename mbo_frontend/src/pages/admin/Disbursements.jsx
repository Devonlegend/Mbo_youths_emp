// src/pages/admin/Disbursements.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { disbursementAPI, applicationAPI } from '../../services/api'
import { AdminNav } from '../../components/layout/index'
import { Card, Badge, Button, Alert, Spinner, Table, Modal } from '../../components/ui/index'

export default function AdminDisbursements() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [selected, setSelected]     = useState([])
  const [authId, setAuthId]         = useState(null)

  const { data: disbData, isLoading } = useQuery({
    queryKey: ['disbursements'],
    queryFn:  () => disbursementAPI.list().then(r => r.data),
  })

  const { data: approvedApps } = useQuery({
    queryKey: ['approved-apps-no-disbursement'],
    queryFn:  () => applicationAPI.list({ status: 'approved', no_disbursement: true }).then(r => r.data),
    enabled: showCreate,
  })

  const createMutation = useMutation({
    mutationFn: () => disbursementAPI.create({ application_ids: selected }),
    onSuccess:  () => {
      queryClient.invalidateQueries(['disbursements'])
      setShowCreate(false)
      setSelected([])
    }
  })

  const authorizeMutation = useMutation({
    mutationFn: (id) => disbursementAPI.authorize(id),
    onSuccess:  () => {
      queryClient.invalidateQueries(['disbursements'])
      setAuthId(null)
    }
  })

  const disbursements = disbData?.results || disbData || []
  const pendingApps   = approvedApps?.results || approvedApps || []

  const columns = [
    { key: 'application', label: 'Student',
      render: (v) => (
        <div>
          <p className="font-medium text-sm">{v?.student?.full_name}</p>
          <p className="text-xs text-gray-400">{v?.scheme?.name}</p>
        </div>
      )
    },
    { key: 'amount', label: 'Amount',
      render: v => `₦${Number(v||0).toLocaleString()}`
    },
    { key: 'status', label: 'Status',
      render: v => <Badge label={v?.replace(/_/g,' ')} type={v === 'completed' ? 'approved' : v === 'failed' ? 'rejected' : 'draft'} />
    },
    { key: 'name_match_passed', label: 'Name Match',
      render: v => v === true  ? <Badge label="Passed" type="approved" /> :
                   v === false ? <Badge label="Failed" type="rejected" /> :
                                 <Badge label="Pending" type="draft" />
    },
    { key: 'authorized_by', label: 'Auth 1',
      render: v => v ? <Badge label="Done" type="approved" /> : <Badge label="Pending" type="draft" />
    },
    { key: 'payment_date', label: 'Paid',
      render: v => v ? new Date(v).toLocaleDateString() : '—'
    },
    { key: 'id', label: 'Action',
      render: (v, row) => {
        if (row.status === 'completed') return <span className="text-green-600 text-xs">✓ Paid</span>
        if (!row.authorized_by) return (
          <Button size="sm" variant="outline" onClick={() => setAuthId(v)}>
            Authorize
          </Button>
        )
        return <span className="text-gray-400 text-xs">Awaiting 2nd auth</span>
      }
    },
  ]

  return (
    <div className="min-h-screen bg-slate-50">
      <AdminNav />
      <div className="max-w-7xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-800">Disbursements</h1>
            <p className="text-sm text-gray-500 mt-1">Award payments — dual authorization required</p>
          </div>
          <Button onClick={() => setShowCreate(true)} variant="gold">Create Batch</Button>
        </div>

        <Alert type="warning" title="Dual authorization policy" className="mb-6">
          Every disbursement requires TWO separate administrators to authorize before payment is processed.
          The authorizing admin cannot be the same person who created the disbursement.
        </Alert>

        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <Card>
            <Table
              columns={columns}
              data={disbursements}
              emptyMessage="No disbursements yet"
            />
          </Card>
        )}
      </div>

      {/* Authorization confirm */}
      <Modal open={!!authId} onClose={() => setAuthId(null)} title="Authorize Disbursement"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAuthId(null)}>Cancel</Button>
            <Button variant="success"
              onClick={() => authorizeMutation.mutate(authId)}
              disabled={authorizeMutation.isPending}>
              {authorizeMutation.isPending ? 'Authorizing...' : 'Confirm Authorization'}
            </Button>
          </>
        }>
        <Alert type="warning">
          You are authorizing a payment to be sent to a student's bank account.
          This action is logged permanently. Ensure the name match has passed before proceeding.
        </Alert>
      </Modal>

      {/* Create batch modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Disbursement Batch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button disabled={selected.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}>
              {createMutation.isPending ? 'Creating...' : `Create Batch (${selected.length} selected)`}
            </Button>
          </>
        }>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            Select approved applications to include in this disbursement batch.
          </p>
          {pendingApps.length === 0 ? (
            <Alert type="info">No approved applications pending disbursement.</Alert>
          ) : pendingApps.map(app => (
            <label key={app.id}
              className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-slate-50 cursor-pointer">
              <input type="checkbox" checked={selected.includes(app.id)}
                onChange={e => setSelected(prev =>
                  e.target.checked ? [...prev, app.id] : prev.filter(i => i !== app.id)
                )} />
              <div className="flex-1">
                <p className="text-sm font-medium">{app.student?.full_name}</p>
                <p className="text-xs text-gray-500">{app.scheme?.name}</p>
              </div>
              <span className="text-sm font-medium text-green-700">
                ₦{Number(app.scheme?.award_amount||0).toLocaleString()}
              </span>
            </label>
          ))}
        </div>
      </Modal>
    </div>
  )
}

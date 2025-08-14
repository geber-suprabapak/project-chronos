'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '~/trpc/react'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Button } from '~/components/ui/button'

type FormValues = {
  fullName: string
  email: string
  avatarUrl: string
  absenceNumber: string
  className: string
  role: 'admin' | 'none'
}

type Props = {
  id: string
  initialData: {
    id: string | number
    userId: string | number
    fullName: string | null
    email: string
    avatarUrl: string | null
    absenceNumber: string | null
    className: string | null
    role: string | null
  }
}

export function EditProfileForm({ id, initialData }: Props) {
  const router = useRouter()

  const initialValues = useMemo<FormValues>(
    () => ({
      fullName: initialData.fullName ?? '',
      email: initialData.email ?? '',
      avatarUrl: initialData.avatarUrl ?? '',
      absenceNumber: initialData.absenceNumber ?? '',
      className: initialData.className ?? '',
      role: initialData.role?.toLowerCase() === 'admin' ? 'admin' : 'none',
    }),
    [initialData],
  )

  const [formValues, setFormValues] = useState<FormValues>(initialValues)
  const [isDirty, setIsDirty] = useState(false)

  useEffect(() => {
    setFormValues(initialValues)
    setIsDirty(false)
  }, [initialValues])

  const utils = api.useUtils()
  const updateMutation = api.userProfiles.update.useMutation({
    onSuccess: async () => {
      await utils.userProfiles.getById.invalidate({ id })
      router.back()
    },
  })

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormValues((prev) => ({ ...prev, [name]: value }))
    setIsDirty(true)
  }

  const handleSelectChange = (value: string) => {
    setFormValues((prev) => ({ ...prev, role: value as FormValues['role'] }))
    setIsDirty(true)
  }

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    const v = formValues
    updateMutation.mutate({
      id,
      data: {
        fullName: v.fullName || undefined,
        email: v.email || undefined,
        avatarUrl: v.avatarUrl || undefined,
        absenceNumber: v.absenceNumber || undefined,
        className: v.className || undefined,
        role: v.role === 'admin' ? 'admin' : undefined,
      },
    })
    setIsDirty(false)
  }

  return (
    <form className="space-y-6" onSubmit={handleFormSubmit}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="fullName">Full Name</Label>
          <Input id="fullName" name="fullName" value={formValues.fullName} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" value={formValues.email} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="className">Class</Label>
          <Input id="className" name="className" value={formValues.className} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="absenceNumber">Absence #</Label>
          <Input id="absenceNumber" name="absenceNumber" value={formValues.absenceNumber} onChange={handleChange} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="role">Role</Label>
          <Select value={formValues.role} onValueChange={handleSelectChange}>
            <SelectTrigger aria-label="Role" id="role">
              <SelectValue placeholder="None" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">None</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="avatarUrl">Avatar URL</Label>
          <Input id="avatarUrl" name="avatarUrl" value={formValues.avatarUrl} onChange={handleChange} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={updateMutation.isPending}>
          {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFormValues(initialValues)
            setIsDirty(false)
          }}
          disabled={updateMutation.isPending || !isDirty}
        >
          Reset
        </Button>
      </div>
    </form>
  )
}

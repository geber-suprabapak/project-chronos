'use client'

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { api } from '~/trpc/react'
import { Label } from '~/components/ui/label'
import { Input } from '~/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '~/components/ui/select'
import { Button } from '~/components/ui/button'
import { toast } from 'sonner'

type FormValues = {
    nis: string
    nama: string
    kelas: string
    absen: string
    kelamin: 'L' | 'P' | ''
    activated: boolean
}

type Props = {
    nis: string
    initialData: {
        nis: bigint
        nama: string | null
        kelas: string | null
        absen: number | null
        kelamin: string | null
        activated: boolean
    }
}

export function EditSiswaForm({ nis, initialData }: Props) {
    const router = useRouter()

    const initialValues = useMemo<FormValues>(
        () => ({
            nis: initialData.nis.toString(),
            nama: initialData.nama ?? '',
            kelas: initialData.kelas ?? '',
            absen: initialData.absen?.toString() ?? '',
            kelamin: (initialData.kelamin as 'L' | 'P') ?? '',
            activated: initialData.activated,
        }),
        [initialData],
    )

    const [formValues, setFormValues] = useState<FormValues>(initialValues)
    const [isDirty, setIsDirty] = useState(false)

    useEffect(() => {
        setFormValues(initialValues)
        setIsDirty(false)
    }, [initialValues])

    const { data: uniqueClasses } = api.biodataSiswa.getUniqueClasses.useQuery()

    const utils = api.useUtils()
    const updateMutation = api.biodataSiswa.updateByNis.useMutation({
        onSuccess: async () => {
            toast.success('Data siswa berhasil diupdate')
            await utils.biodataSiswa.getByNis.invalidate({ nis: BigInt(nis) })
            await utils.biodataSiswa.list.invalidate()
            router.back()
        },
        onError: (error) => {
            toast.error(`Error: ${error.message}`)
        },
    })

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target
        setFormValues((prev) => ({ ...prev, [name]: value }))
        setIsDirty(true)
    }

    const handleSelectChange = (value: string, field: keyof FormValues) => {
        if (field === 'activated') {
            setFormValues((prev) => ({ ...prev, [field]: value === 'true' }))
        } else {
            setFormValues((prev) => ({ ...prev, [field]: value }))
        }
        setIsDirty(true)
    }

    const handleFormSubmit = (e: FormEvent) => {
        e.preventDefault()

        // Validasi form
        if (!formValues.nama || !formValues.kelas || !formValues.absen || !formValues.kelamin) {
            toast.error('Semua field wajib diisi')
            return
        }

        // Validasi absen harus angka
        const absenNum = parseInt(formValues.absen)
        if (isNaN(absenNum) || absenNum <= 0) {
            toast.error('Nomor absen harus berupa angka positif')
            return
        }

        const v = formValues
        updateMutation.mutate({
            nis: BigInt(nis),
            data: {
                nama: v.nama,
                kelas: v.kelas,
                absen: absenNum,
                kelamin: v.kelamin as 'L' | 'P',
                activated: v.activated,
            },
        })
        setIsDirty(false)
    }

    return (
        <form className="space-y-6" onSubmit={handleFormSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="nis">NIS</Label>
                    <Input
                        id="nis"
                        name="nis"
                        value={formValues.nis}
                        onChange={handleChange}
                        disabled // NIS tidak bisa diubah
                        className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">NIS tidak dapat diubah</p>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="nama">Nama Lengkap</Label>
                    <Input
                        id="nama"
                        name="nama"
                        value={formValues.nama}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="kelas">Kelas</Label>
                    <Select value={formValues.kelas} onValueChange={(value) => handleSelectChange(value, 'kelas')}>
                        <SelectTrigger aria-label="Kelas" id="kelas">
                            <SelectValue placeholder="Pilih kelas" />
                        </SelectTrigger>
                        <SelectContent>
                            {uniqueClasses?.map((kelas) => (
                                <SelectItem key={kelas} value={kelas}>
                                    {kelas}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {/* Input manual untuk kelas baru */}
                    <Input
                        placeholder="Atau ketik kelas baru"
                        value={formValues.kelas}
                        onChange={(e) => {
                            setFormValues((prev) => ({ ...prev, kelas: e.target.value }))
                            setIsDirty(true)
                        }}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="absen">No. Absen</Label>
                    <Input
                        id="absen"
                        name="absen"
                        type="number"
                        value={formValues.absen}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="kelamin">Jenis Kelamin</Label>
                    <Select value={formValues.kelamin} onValueChange={(value) => handleSelectChange(value, 'kelamin')}>
                        <SelectTrigger aria-label="Jenis Kelamin" id="kelamin">
                            <SelectValue placeholder="Pilih jenis kelamin" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="L">Laki-laki</SelectItem>
                            <SelectItem value="P">Perempuan</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="activated">Status</Label>
                    <Select
                        value={formValues.activated ? 'true' : 'false'}
                        onValueChange={(value) => handleSelectChange(value, 'activated')}
                    >
                        <SelectTrigger aria-label="Status" id="activated">
                            <SelectValue placeholder="Pilih status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="true">Aktif</SelectItem>
                            <SelectItem value="false">Tidak Aktif</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <Button type="submit" disabled={updateMutation.isPending || !isDirty}>
                    {updateMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
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
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() => router.back()}
                    disabled={updateMutation.isPending}
                >
                    Batal
                </Button>
            </div>
        </form>
    )
}
